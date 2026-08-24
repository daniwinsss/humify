import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeAILikelihood } from "@/lib/analysis/ai-likelihood";
import { AI_LIKELIHOOD_WEIGHTS, AI_LIKELIHOOD_THRESHOLDS } from "@/lib/analysis/config";
import type { AILikelihoodSignals } from "@/types";

const SIGNAL_KEYS: (keyof AILikelihoodSignals)[] = [
  "repetition",
  "sentenceUniformity",
  "lexicalDiversity",
  "predictability",
  "structuralPatterns",
];

const FORMULAIC = `Artificial intelligence is transforming the modern workplace. It is important to note that organizations must adapt quickly. Furthermore, the adoption of these tools requires careful consideration.

Machine learning models are becoming increasingly sophisticated. Moreover, they play a crucial role in decision making. Additionally, businesses must navigate the complexities of implementation.

The future of work will depend on these technologies. Consequently, leaders must prepare their teams. Therefore, investment in training is essential.`;

const VARIED = `I didn't expect much from the new setup. Honestly? It surprised me. Our team shipped three features in a week — something that used to take a month, back when every deploy meant a late night and a lot of coffee. Not everything worked. The search index broke twice. But we learned fast, and that's the part I keep coming back to.`;

describe("ai-likelihood scoring", () => {
  it("produces the same score every time for the same input", () => {
    const first = analyzeAILikelihood(FORMULAIC);
    for (let i = 0; i < 5; i++) {
      const again = analyzeAILikelihood(FORMULAIC);
      assert.equal(again.score, first.score);
      assert.deepEqual(again.signals, first.signals);
      assert.equal(again.label, first.label);
      assert.equal(again.confidence, first.confidence);
    }
  });

  it("handles empty and whitespace-only input without throwing", () => {
    for (const input of ["", "   ", "\n\n\n", "\t"]) {
      const result = analyzeAILikelihood(input);
      assert.equal(result.score, 0);
      assert.equal(result.confidence, 0);
      assert.equal(result.lowConfidence, true);
      assert.deepEqual(result.explanation, ["No text to analyze."]);
    }
  });

  it("flags very short text as low confidence rather than pretending to be sure", () => {
    const result = analyzeAILikelihood("AI is transforming industries.");
    assert.equal(result.lowConfidence, true);
    assert.ok(
      result.confidence < 50,
      `expected low confidence for a 4-word input, got ${result.confidence}`
    );
    assert.ok(
      result.explanation.some((line) => line.includes("too short")),
      "expected an explanation mentioning the text is too short"
    );
  });

  it("stops flagging low confidence once there is enough text", () => {
    const result = analyzeAILikelihood(FORMULAIC);
    assert.equal(result.lowConfidence, false);
    assert.ok(result.confidence > 30);
  });

  it("analyzes repetitive, formulaic text", () => {
    const result = analyzeAILikelihood(
      "It is important to note that it is important to understand that it is important to recognize the importance of clear communication in all professional settings."
    );
    assert.ok(result.score >= 0 && result.score <= 100);
    assert.ok(
      result.signals.repetition > 30,
      `expected the repetition signal to fire, got ${result.signals.repetition}`
    );
  });

  it("analyzes highly varied text", () => {
    const result = analyzeAILikelihood(VARIED);
    assert.ok(result.score >= 0 && result.score <= 100);
    assert.ok(
      result.signals.sentenceUniformity < 40,
      `varied sentence lengths should read as non-uniform, got ${result.signals.sentenceUniformity}`
    );
  });

  it("rates formulaic prose higher than varied prose", () => {
    // Relative ordering is the meaningful assertion. The absolute numbers depend
    // on calibration constants that are expected to be retuned over time.
    const formulaic = analyzeAILikelihood(FORMULAIC);
    const varied = analyzeAILikelihood(VARIED);
    assert.ok(
      formulaic.score > varied.score,
      `expected formulaic (${formulaic.score}) > varied (${varied.score})`
    );
  });

  it("clamps the score and every signal to 0-100 across awkward inputs", () => {
    const inputs = [
      "",
      "   ",
      "word",
      "Hi.",
      "!!!???...",
      "aaa ".repeat(500),
      "Ünïcôdé têxt with accénts and émojis 🎉 that should not break tokenizing.",
      "no terminal punctuation at all just a long run of words that never ends anywhere",
      "\n\n\n\n",
      "A. B. C. D. E. F.",
      "1234 5678 9012",
      "The ".repeat(2000),
    ];

    for (const input of inputs) {
      const result = analyzeAILikelihood(input);
      assert.ok(
        Number.isInteger(result.score) && result.score >= 0 && result.score <= 100,
        `score out of range for ${JSON.stringify(input.slice(0, 30))}: ${result.score}`
      );
      assert.ok(
        Number.isInteger(result.confidence) &&
          result.confidence >= 0 &&
          result.confidence <= 100,
        `confidence out of range: ${result.confidence}`
      );
      for (const key of SIGNAL_KEYS) {
        const value = result.signals[key];
        assert.ok(
          Number.isInteger(value) && value >= 0 && value <= 100,
          `signal ${key} out of range for ${JSON.stringify(input.slice(0, 30))}: ${value}`
        );
      }
      assert.ok(result.explanation.length > 0, "explanation should never be empty");
    }
  });

  it("keeps the weights normalized to 1.0", () => {
    const total = Object.values(AI_LIKELIHOOD_WEIGHTS).reduce((sum, w) => sum + w, 0);
    assert.ok(
      Math.abs(total - 1) < 1e-9,
      `weights must sum to 1.0 or the score leaves the 0-100 scale, got ${total}`
    );
  });

  it("assigns labels consistently with the configured bands", () => {
    const { bands } = AI_LIKELIHOOD_THRESHOLDS;
    for (const input of [FORMULAIC, VARIED, "Short text here.", ""]) {
      const { score, label } = analyzeAILikelihood(input);
      const expected =
        score < bands.low ? "Low" : score < bands.moderate ? "Moderate" : "High";
      assert.equal(label, expected, `score ${score} should be labelled ${expected}`);
    }
  });

  it("does not leak signal internals into the explanation as raw numbers", () => {
    const result = analyzeAILikelihood(FORMULAIC);
    for (const line of result.explanation) {
      assert.ok(
        !/\d+\.\d+/.test(line),
        `explanation should stay plain-language, found a raw metric in: ${line}`
      );
    }
  });
});
