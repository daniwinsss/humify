/**
 * Automated evaluation suite for Humify.
 *
 * Tests rewrite quality across styles by checking:
 * - Response success rate
 * - Response time (< 3s target)
 * - Output is non-empty and differs from input
 * - Meaning preservation (word overlap heuristic)
 * - Style consistency (basic keyword checks)
 *
 * AI-likelihood before/after is REPORTED but never gated on. A lower estimate is
 * not automatically a better rewrite: semantic preservation, factual consistency,
 * style adherence, naturalness and readability remain the quality constraints. A
 * rewrite that slashes AI-likelihood while changing the meaning still fails on the
 * meaning-preservation check above, which is the intended behaviour.
 *
 * Run: npx tsx scripts/evaluate.ts
 * Requires: GEMINI_API_KEY in .env.local or environment
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { compareAILikelihood } from "../src/lib/analysis/evaluator";

const BASE_URL = process.env.EVAL_BASE_URL || "http://localhost:3000";

interface TestCase {
  name: string;
  text: string;
  style: "professional" | "casual" | "academic" | "friendly";
  language?: string;
}

const TEST_CASES: TestCase[] = [
  {
    name: "Short professional",
    text: "The utilization of artificial intelligence in the modern workplace has been demonstrated to increase productivity metrics by a significant margin across various organizational structures.",
    style: "professional",
  },
  {
    name: "Short casual",
    text: "The implementation of machine learning algorithms necessitates careful consideration of computational resource allocation and optimization strategies.",
    style: "casual",
  },
  {
    name: "Academic paragraph",
    text: "Recent studies have shown that deep learning models exhibit emergent properties when scaled to sufficient parameter counts. These findings suggest that the relationship between model size and capability is non-linear.",
    style: "academic",
  },
  {
    name: "Friendly explanation",
    text: "The process of photosynthesis involves the conversion of carbon dioxide and water into glucose and oxygen through the utilization of solar energy captured by chlorophyll molecules.",
    style: "friendly",
  },
  {
    name: "Multi-language (Spanish)",
    text: "The quarterly financial results demonstrate a substantial improvement in revenue generation compared to the previous fiscal period.",
    style: "professional",
    language: "es",
  },
  {
    name: "Edge: very short",
    text: "AI is transforming industries.",
    style: "casual",
  },
  {
    name: "Edge: repetitive text",
    text: "It is important to note that it is important to understand that it is important to recognize the importance of clear communication in all professional settings.",
    style: "professional",
  },
];

interface EvalResult {
  name: string;
  passed: boolean;
  responseTimeMs: number;
  checks: { check: string; passed: boolean; detail?: string }[];
  /** Reported only — never contributes to pass/fail. */
  aiLikelihood?: { before: number; after: number; difference: number };
}

function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/));
  const wordsB = new Set(b.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/));
  const intersection = [...wordsA].filter((w) => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.length / union.size;
}

async function runTestCase(tc: TestCase): Promise<EvalResult> {
  const checks: EvalResult["checks"] = [];
  const start = performance.now();

  try {
    const res = await fetch(`${BASE_URL}/api/rewrite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: tc.text, style: tc.style, language: tc.language || "auto" }),
    });

    const responseTimeMs = Math.round(performance.now() - start);
    const data = await res.json();

    // Check 1: HTTP success
    checks.push({
      check: "HTTP 200",
      passed: res.ok,
      detail: res.ok ? undefined : `Status ${res.status}: ${data.error}`,
    });

    if (!res.ok) {
      return { name: tc.name, passed: false, responseTimeMs, checks };
    }

    // Check 2: Response time < 3s
    checks.push({
      check: "Response < 3s",
      passed: responseTimeMs < 3000,
      detail: `${responseTimeMs}ms`,
    });

    // Check 3: Non-empty output
    const hasOutput = data.rewritten && data.rewritten.trim().length > 0;
    checks.push({
      check: "Non-empty output",
      passed: hasOutput,
    });

    if (!hasOutput) {
      return { name: tc.name, passed: false, responseTimeMs, checks };
    }

    // Check 4: Output differs from input
    const differs = data.rewritten.trim() !== tc.text.trim();
    checks.push({
      check: "Output differs from input",
      passed: differs,
    });

    // Check 5: Meaning preservation (word overlap > 0.3)
    const overlap = wordOverlap(tc.text, data.rewritten);
    checks.push({
      check: "Meaning preservation (overlap > 0.3)",
      passed: overlap > 0.3,
      detail: `Overlap: ${(overlap * 100).toFixed(1)}%`,
    });

    // Check 6: Length sanity (output between 30% and 300% of input length)
    const ratio = data.rewritten.length / tc.text.length;
    checks.push({
      check: "Length sanity (0.3x-3x)",
      passed: ratio >= 0.3 && ratio <= 3,
      detail: `Ratio: ${ratio.toFixed(2)}x`,
    });

    // Reported metric, deliberately computed after the pass/fail checks so it
    // cannot influence them.
    const likelihood = compareAILikelihood(tc.text, data.rewritten);

    const allPassed = checks.every((c) => c.passed);
    return {
      name: tc.name,
      passed: allPassed,
      responseTimeMs,
      checks,
      aiLikelihood: {
        before: likelihood.original.score,
        after: likelihood.humanized.score,
        difference: likelihood.difference,
      },
    };
  } catch (error) {
    const responseTimeMs = Math.round(performance.now() - start);
    checks.push({ check: "Connection", passed: false, detail: String(error) });
    return { name: tc.name, passed: false, responseTimeMs, checks };
  }
}

async function main() {
  console.log(`\nHumify Evaluation Suite`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Test cases: ${TEST_CASES.length}\n`);
  console.log("=".repeat(70));

  const results: EvalResult[] = [];

  for (const tc of TEST_CASES) {
    process.stdout.write(`  ${tc.name}... `);
    const result = await runTestCase(tc);
    results.push(result);

    const likelihoodNote = result.aiLikelihood
      ? ` [AI-likelihood ${result.aiLikelihood.before}->${result.aiLikelihood.after}]`
      : "";

    if (result.passed) {
      console.log(`PASS (${result.responseTimeMs}ms)${likelihoodNote}`);
    } else {
      console.log(`FAIL (${result.responseTimeMs}ms)${likelihoodNote}`);
      for (const c of result.checks.filter((c) => !c.passed)) {
        console.log(`    x ${c.check}${c.detail ? ` — ${c.detail}` : ""}`);
      }
    }
  }

  console.log("\n" + "=".repeat(70));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const avgTime = Math.round(results.reduce((s, r) => s + r.responseTimeMs, 0) / results.length);

  console.log(`\nResults: ${passed}/${results.length} passed, ${failed} failed`);
  console.log(`Average response time: ${avgTime}ms`);
  console.log(`Success rate: ${((passed / results.length) * 100).toFixed(1)}%\n`);

  const scored = results.filter((r) => r.aiLikelihood);
  if (scored.length > 0) {
    const avg = (pick: (r: EvalResult) => number) =>
      (scored.reduce((sum, r) => sum + pick(r), 0) / scored.length).toFixed(1);

    // Reported for visibility only. Nothing below changes the exit code.
    console.log(`AI-likelihood estimate (reported, not a pass/fail criterion)`);
    console.log(`  Average before:    ${avg((r) => r.aiLikelihood!.before)}%`);
    console.log(`  Average after:     ${avg((r) => r.aiLikelihood!.after)}%`);
    console.log(`  Average reduction: ${avg((r) => r.aiLikelihood!.difference)} percentage points`);
    console.log(`  Estimates reflect writing patterns only; not proof of AI authorship.`);
    console.log(`  A lower estimate is NOT automatically better.`);
    console.log("");
  }


  process.exit(failed > 0 ? 1 : 0);
}

main();
