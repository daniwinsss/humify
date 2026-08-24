import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  batchBlocks,
  decodeBlock,
  encodeBlock,
  humanizeBlocks,
} from "@/lib/documents/common/segment-humanizer";
import { makeRun, splitWhitespace, isHumanizableText } from "@/lib/documents/common/document-model";
import type { TextBlock } from "@/lib/documents/common/types";
import { fakeModel, flakyModel } from "./helpers/fake-model";

function block(id: string, ...texts: string[]): TextBlock {
  return { id, kind: "paragraph", runs: texts.map((t, i) => makeRun(`${id}r${i}`, t)) };
}

describe("whitespace handling", () => {
  it("splits and restores edge whitespace exactly", () => {
    const cases = ["  hello  ", "hello", "\n\tvalue\n", "   ", ""];
    for (const input of cases) {
      const { lead, core, trail } = splitWhitespace(input);
      assert.equal(lead + core + trail, input, `round trip failed for ${JSON.stringify(input)}`);
    }
  });

  it("treats a whitespace-only string as having no core", () => {
    assert.equal(splitWhitespace("   ").core, "");
  });
});

describe("humanizable text detection", () => {
  it("accepts prose", () => {
    assert.ok(isHumanizableText("This is a sentence."));
  });

  it("rejects bare URLs, emails, numbers and punctuation", () => {
    for (const input of ["https://example.com/docs", "ops@example.com", "1,200", "—", "()", "42"]) {
      assert.ok(!isHumanizableText(input), `should have rejected ${input}`);
    }
  });
});

describe("marker protocol", () => {
  it("encodes run boundaries and decodes them back", () => {
    const b = block("b1", "This is ", "very important", " information.");
    assert.equal(encodeBlock(b), "This is[[1]]very important[[2]]information.");

    const decoded = decodeBlock(b, "This is[[1]]extremely important[[2]]info.");
    assert.deepEqual(decoded, ["This is", "extremely important", "info."]);
  });

  it("tolerates the model adding spaces around markers", () => {
    const b = block("b1", "This is ", "very important", " information.");
    assert.deepEqual(decodeBlock(b, "This is [[1]] extremely important [[2]] info."), [
      "This is",
      "extremely important",
      "info.",
    ]);
  });

  it("rejects a reply with a missing marker", () => {
    const b = block("b1", "a ", "b", " c");
    assert.equal(decodeBlock(b, "a[[1]]b c"), null);
  });

  it("rejects markers that come back out of order", () => {
    const b = block("b1", "a ", "b", " c");
    assert.equal(decodeBlock(b, "a[[2]]b[[1]]c"), null);
  });

  it("rejects duplicated markers", () => {
    const b = block("b1", "a ", "b", " c");
    assert.equal(decodeBlock(b, "a[[1]]b[[1]]c"), null);
  });

  it("ignores whitespace-only runs when placing markers", () => {
    const b = block("b1", "Hello", "   ", "world");
    assert.equal(encodeBlock(b), "Hello[[1]]world");
  });
});

describe("batching", () => {
  it("packs blocks up to the character budget", () => {
    const blocks = Array.from({ length: 10 }, (_, i) => block(`b${i}`, "x".repeat(40)));
    const batches = batchBlocks(blocks, 100);
    assert.ok(batches.length > 1);
    assert.equal(batches.flat().length, 10);
    for (const batch of batches) {
      assert.ok(batch.length <= 3, "no batch should exceed the budget by more than one block");
    }
  });

  it("sends an oversized block on its own rather than dropping it", () => {
    const batches = batchBlocks([block("b0", "y".repeat(500))], 100);
    assert.equal(batches.length, 1);
    assert.equal(batches[0].length, 1);
  });

  it("keeps the call count far below the fragment count", async () => {
    const blocks = Array.from({ length: 60 }, (_, i) => block(`b${i}`, "This ", "is ", "a ", "sentence."));
    const result = await humanizeBlocks(blocks, { systemPrompt: "p", rewrite: fakeModel() });
    assert.ok(result.geminiCalls < 10, `expected batching, got ${result.geminiCalls} calls`);
    assert.equal(result.blocksRewritten, 60);
  });
});

describe("humanizeBlocks", () => {
  it("maps rewritten text back to the right runs", async () => {
    const b = block("b1", "This is ", "very important", " information.");
    const result = await humanizeBlocks([b], { systemPrompt: "p", rewrite: fakeModel() });

    assert.equal(result.replacements.get("b1r0"), "THIS IS");
    assert.equal(result.replacements.get("b1r1"), "VERY IMPORTANT");
    assert.equal(result.replacements.get("b1r2"), "INFORMATION.");
  });

  it("never sends bare URLs or emails", async () => {
    const calls: string[] = [];
    const blocks = [block("b1", "https://example.com/docs"), block("b2", "Real prose goes here.")];
    await humanizeBlocks(blocks, { systemPrompt: "p", rewrite: fakeModel({ calls }) });

    assert.equal(calls.length, 1);
    assert.ok(!calls[0].includes("example.com"));
    assert.ok(calls[0].includes("Real prose goes here."));
  });

  it("keeps the original text and warns when markers come back malformed", async () => {
    const b = block("b1", "This is ", "very important", " information.");
    const result = await humanizeBlocks([b], {
      systemPrompt: "p",
      rewrite: fakeModel({ dropMarkers: true }),
    });

    assert.equal(result.replacements.size, 0, "no run should be replaced from a bad decode");
    assert.equal(result.blocksRewritten, 0);
    assert.ok(result.warnings.some((w) => w.code === "marker-mismatch"));
  });

  it("retries a block individually when its batch reply is truncated", async () => {
    const blocks = [block("b1", "First paragraph here."), block("b2", "Second paragraph here.")];
    const calls: string[] = [];
    let first = true;

    const result = await humanizeBlocks(blocks, {
      systemPrompt: "p",
      batchBudget: 10_000,
      rewrite: async (text, prompt) => {
        const omit = first ? 1 : 0;
        first = false;
        return fakeModel({ omitBlocks: omit, calls })(text, prompt);
      },
    });

    // Both blocks end up rewritten: the dropped one via its own follow-up call.
    assert.equal(result.blocksRewritten, 2);
    assert.ok(result.geminiCalls > 1);
  });

  it("recovers when a whole batch call fails but a retry succeeds", async () => {
    const blocks = [block("b1", "First paragraph here."), block("b2", "Second paragraph here.")];
    const result = await humanizeBlocks(blocks, {
      systemPrompt: "p",
      batchBudget: 10_000,
      rewrite: flakyModel(1),
    });

    assert.equal(result.blocksRewritten, 2);
  });

  it("throws rather than returning an unchanged document when Gemini is down", async () => {
    const blocks = [block("b1", "First paragraph here.")];
    await assert.rejects(
      () => humanizeBlocks(blocks, { systemPrompt: "p", rewrite: fakeModel({ fail: true }) }),
      /Gemini|failed/i
    );
  });

  it("reports skipped non-prose blocks instead of hiding them", async () => {
    const blocks = [block("b1", "Real prose here."), block("b2", "12345")];
    const result = await humanizeBlocks(blocks, { systemPrompt: "p", rewrite: fakeModel() });

    assert.equal(result.blocksSkipped, 1);
    assert.ok(result.warnings.some((w) => w.code === "block-skipped"));
  });

  it("freezes a URL or email run inside an otherwise rewritten sentence", async () => {
    const b = block("b1", "Contact ", "ops@example.com", " or visit ", "https://example.com/docs", " today.");
    const result = await humanizeBlocks([b], { systemPrompt: "p", rewrite: fakeModel() });

    assert.equal(result.replacements.get("b1r0"), "CONTACT");
    assert.equal(result.replacements.has("b1r1"), false, "the email must keep its original text");
    assert.equal(result.replacements.get("b1r2"), "OR VISIT");
    assert.equal(result.replacements.has("b1r3"), false, "the URL must keep its original text");
    assert.equal(result.replacements.get("b1r4"), "TODAY.");
  });

  it("rejects a decode that would empty a run", async () => {
    const b = block("b1", "Alpha ", "Beta", " Gamma");
    const result = await humanizeBlocks([b], {
      systemPrompt: "p",
      rewrite: fakeModel({ transform: (s) => (s.trim() === "Beta" ? "" : s) }),
    });

    assert.equal(result.replacements.size, 0);
    assert.ok(result.warnings.some((w) => w.code === "marker-mismatch"));
  });
});
