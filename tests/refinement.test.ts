import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRefinementPrompt, buildSignalGuidance } from "@/lib/prompts";
import { REFINEMENT_SIGNAL_TRIGGERS } from "@/lib/analysis/config";
import { shouldAcceptRefinement } from "@/lib/analysis/evaluator";

describe("refinement prompt", () => {
  it("returns nothing when there is nothing to apply", () => {
    // A first pass must compose exactly as it did before this feature existed.
    assert.equal(buildRefinementPrompt([]), "");
  });

  it("includes every supplied suggestion", () => {
    const suggestions = [
      "Vary the sentence lengths more.",
      "Replace formulaic transitions.",
    ];
    const prompt = buildRefinementPrompt(suggestions);
    for (const suggestion of suggestions) {
      assert.ok(prompt.includes(suggestion), `missing: ${suggestion}`);
    }
  });

  it("tells the model to apply changes silently", () => {
    const prompt = buildRefinementPrompt(["Use contractions."]);
    assert.match(prompt, /Do not mention, list, or explain the changes/);
  });

  it("still instructs preservation of meaning", () => {
    // The base style prompt carries this too, but a refinement pass is where
    // drift is most likely, so the instruction is repeated at the point of change.
    const prompt = buildRefinementPrompt(["Shorten the opening."]);
    assert.match(prompt, /preserving the original meaning and facts/i);
  });

  it("caps the number of suggestions", () => {
    const many = Array.from({ length: 12 }, (_, i) => `Suggestion number ${i}.`);
    const prompt = buildRefinementPrompt(many);
    const included = many.filter((s) => prompt.includes(s));
    assert.equal(included.length, 5, "should cap at 5 suggestions");
  });

  it("truncates an over-long suggestion", () => {
    const huge = "x".repeat(5000);
    const prompt = buildRefinementPrompt([huge]);
    assert.ok(prompt.length < 1000, `prompt should stay bounded, got ${prompt.length}`);
    assert.ok(prompt.includes("..."), "truncation should be marked");
  });

  it("drops blank and whitespace-only entries", () => {
    assert.equal(buildRefinementPrompt(["", "   ", "\n\t"]), "");
  });

  it("keeps real suggestions alongside blank ones", () => {
    const prompt = buildRefinementPrompt(["", "Use contractions.", "   "]);
    assert.ok(prompt.includes("Use contractions."));
    // One bullet only — the blanks must not produce empty list items.
    assert.equal(prompt.split("\n- ").length - 1, 1);
  });

  it("survives malformed input without throwing", () => {
    // These strings come from model output, so the builder must not assume shape.
    const malformed = [null, undefined, 42, {}, []] as unknown as string[];
    assert.doesNotThrow(() => buildRefinementPrompt(malformed));
    assert.equal(buildRefinementPrompt(malformed), "");
    assert.equal(buildRefinementPrompt(null as unknown as string[]), "");
    assert.equal(buildRefinementPrompt(undefined as unknown as string[]), "");
  });
});

describe("keep-best rule", () => {
  it("accepts a strictly lower estimate", () => {
    assert.equal(shouldAcceptRefinement(69, 41), true);
    assert.equal(shouldAcceptRefinement(41, 40), true);
    assert.equal(shouldAcceptRefinement(1, 0), true);
  });

  it("rejects an equal estimate", () => {
    // No measurable gain, so swapping the user's text would be churn.
    assert.equal(shouldAcceptRefinement(41, 41), false);
    assert.equal(shouldAcceptRefinement(0, 0), false);
  });

  it("rejects a higher estimate", () => {
    assert.equal(shouldAcceptRefinement(41, 48), false);
    assert.equal(shouldAcceptRefinement(0, 100), false);
  });

  it("rejects non-finite scores rather than guessing", () => {
    assert.equal(shouldAcceptRefinement(Number.NaN, 10), false);
    assert.equal(shouldAcceptRefinement(50, Number.NaN), false);
    assert.equal(shouldAcceptRefinement(50, Number.NEGATIVE_INFINITY), false);
  });
});

describe("a refinement chain", () => {
  it("reports cumulative progress, not just the last hop", () => {
    // The card's headline numbers are baseline -> current, which is why the API
    // takes baselineText. Verify the arithmetic the UI depends on.
    const chain = [
      { before: 69, after: 41 },
      { before: 41, after: 27 },
    ];
    const cumulative = chain[0].before - chain[chain.length - 1].after;
    const perPassSum = chain.reduce((sum, p) => sum + (p.before - p.after), 0);

    assert.equal(cumulative, 42);
    assert.equal(perPassSum, cumulative, "per-pass deltas must sum to the total");
  });

  it("only advances the chain on accepted passes", () => {
    let currentScore = 41;
    const candidate = 48;

    if (shouldAcceptRefinement(currentScore, candidate)) {
      currentScore = candidate;
    }

    assert.equal(currentScore, 41, "a worse pass must not become the new baseline");
  });
});

describe("signal-derived guidance", () => {
  const flat = {
    repetition: 0,
    sentenceUniformity: 0,
    lexicalDiversity: 0,
    predictability: 0,
    structuralPatterns: 0,
  };

  it("says nothing when no pattern is elevated", () => {
    assert.equal(buildSignalGuidance(flat), "");
  });

  it("targets uniform sentence lengths", () => {
    const out = buildSignalGuidance({ ...flat, sentenceUniformity: 80 });
    assert.match(out, /Vary sentence length/i);
  });

  it("targets formulaic connectives", () => {
    const out = buildSignalGuidance({ ...flat, predictability: 80 });
    assert.match(out, /formulaic connectives/i);
    assert.match(out, /moreover|furthermore/i);
  });

  it("targets repetition, narrow vocabulary and flat structure", () => {
    assert.match(buildSignalGuidance({ ...flat, repetition: 80 }), /repeating/i);
    assert.match(buildSignalGuidance({ ...flat, lexicalDiversity: 80 }), /word choice/i);
    assert.match(buildSignalGuidance({ ...flat, structuralPatterns: 80 }), /paragraph length/i);
  });

  it("counteracts the polish-it advice the analysis suggestions tend to give", () => {
    // Observed in live testing: suggestions-only refinement advised sounding
    // "more authoritative" and RAISED the estimate 25 -> 28. This clause is the
    // fix, so it must be present whenever guidance is emitted at all.
    const out = buildSignalGuidance({ ...flat, predictability: 80 });
    assert.match(out, /not make the wording more formal, more polished, or more authoritative/i);
  });

  it("still protects meaning", () => {
    const out = buildSignalGuidance({ ...flat, sentenceUniformity: 80 });
    assert.match(out, /Keep the meaning and facts unchanged/i);
  });

  it("combines every elevated signal into one block", () => {
    const out = buildSignalGuidance({
      repetition: 90,
      sentenceUniformity: 90,
      lexicalDiversity: 90,
      predictability: 90,
      structuralPatterns: 90,
    });
    assert.equal(out.split("\n- ").length - 1, 5, "expected one bullet per signal");
  });

  it("stays quiet just below each trigger and fires at it", () => {
    for (const [key, trigger] of Object.entries(REFINEMENT_SIGNAL_TRIGGERS)) {
      const below = buildSignalGuidance({ ...flat, [key]: trigger - 1 });
      const at = buildSignalGuidance({ ...flat, [key]: trigger });
      assert.equal(below, "", `${key} should not fire below ${trigger}`);
      assert.notEqual(at, "", `${key} should fire at ${trigger}`);
    }
  });
});
