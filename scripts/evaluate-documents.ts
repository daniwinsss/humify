/**
 * End-to-end document evaluation against the real Gemini API.
 *
 * The unit tests drive the pipeline with a stand-in model, which proves the formatting
 * machinery is correct but says nothing about how a real model behaves with the marker
 * protocol. This script closes that gap: it runs actual fixtures through actual Gemini and
 * reports how many blocks survived the round trip.
 *
 * Run: npx tsx scripts/evaluate-documents.ts
 * Requires: GEMINI_API_KEY in .env.local or environment
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";

config({ path: ".env.local" });

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set. Add it to .env.local.");
    process.exit(1);
  }

  const { processDocument } = await import("../src/lib/documents/process");
  const { formatReportText } = await import("../src/lib/documents/report");
  const { stylePrompts } = await import("../src/lib/prompts");
  const { richDocx } = await import("../tests/fixtures/docx-fixtures");

  const systemPrompt = stylePrompts.professional + " Output the rewritten text in the same language as the input.";

  const cases: { name: string; format: "html" | "docx"; buffer: Buffer }[] = [
    {
      name: "rich.html",
      format: "html",
      buffer: readFileSync(join(process.cwd(), "tests", "fixtures", "html", "rich.html")),
    },
    { name: "rich.docx", format: "docx", buffer: await richDocx() },
  ];

  console.log("\nHumify Document Evaluation (live Gemini)\n" + "=".repeat(70));

  let failures = 0;

  for (const testCase of cases) {
    console.log(`\n▸ ${testCase.name}`);
    const started = Date.now();

    try {
      const result = await processDocument({
        filename: testCase.name,
        format: testCase.format,
        buffer: testCase.buffer,
        systemPrompt,
      });

      const elapsed = Date.now() - started;
      console.log(
        `  ${result.stats.blocks} blocks · ${result.stats.runs} runs · ` +
          `${result.stats.geminiCalls} Gemini call(s) · ${elapsed}ms`
      );
      console.log(
        formatReportText(result.report)
          .split("\n")
          .map((line) => `  ${line}`)
          .join("\n")
      );

      if (!result.report.fullyPreserved) failures++;
      if (!result.report.textModified) {
        console.log("  ! text was not modified");
        failures++;
      }

      const preview = result.textPreview.humanized.slice(0, 200).replace(/\n+/g, " ");
      console.log(`\n  Sample: ${preview}…`);
    } catch (error) {
      failures++;
      console.log(`  FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(failures === 0 ? "All documents fully preserved.\n" : `${failures} issue(s) found.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
