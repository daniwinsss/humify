import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildComparison,
  compareAILikelihood,
  interpretDifference,
  summaryFromStoredScores,
  toSummary,
} from "@/lib/analysis/evaluator";
import { AI_LIKELIHOOD_THRESHOLDS } from "@/lib/analysis/config";
import type { AILikelihoodResult } from "@/types";

/** Minimal stand-in so difference arithmetic is tested without depending on scoring. */
function result(score: number, lowConfidence = false): AILikelihoodResult {
  return {
    score,
    label: score < 34 ? "Low" : score < 67 ? "Moderate" : "High",
    confidence: 80,
    lowConfidence,
    signals: {
      repetition: 0,
      sentenceUniformity: 0,
      lexicalDiversity: 0,
      predictability: 0,
      structuralPatterns: 0,
    },
    explanation: [],
  };
}

describe("before/after difference", () => {
  it("computes original minus humanized", () => {
    const comparison = buildComparison(result(82), result(31));
    assert.equal(comparison.difference, 51);
    assert.equal(comparison.original.score, 82);
    assert.equal(comparison.humanized.score, 31);
  });

  it("reports a negative difference when the estimate rises", () => {
    const comparison = buildComparison(result(42), result(61));
    assert.equal(comparison.difference, -19);
    assert.equal(comparison.interpretation, "increase");
    assert.equal(comparison.improved, false);
  });

  it("treats a small change as insignificant", () => {
    const comparison = buildComparison(result(74), result(72));
    assert.equal(comparison.difference, 2);
    assert.equal(comparison.interpretation, "minimal_change");
    assert.equal(comparison.improved, false);
  });

  it("marks a large drop as a significant reduction", () => {
    const comparison = buildComparison(result(82), result(31));
    assert.equal(comparison.interpretation, "significant_reduction");
    assert.equal(comparison.improved, true);
  });
});

describe("interpretation banding", () => {
  const { significantChange } = AI_LIKELIHOOD_THRESHOLDS;

  it("treats exactly the threshold as minimal change, not significant", () => {
    assert.equal(interpretDifference(significantChange), "minimal_change");
    assert.equal(interpretDifference(-significantChange), "minimal_change");
  });

  it("switches just past the threshold in both directions", () => {
    assert.equal(interpretDifference(significantChange + 1), "significant_reduction");
    assert.equal(interpretDifference(-significantChange - 1), "increase");
  });

  it("treats no change as minimal", () => {
    assert.equal(interpretDifference(0), "minimal_change");
  });
});

describe("comparison from real text", () => {
  it("scores both sides and stays within range", () => {
    const comparison = compareAILikelihood(
      "It is important to note that this is a test. Furthermore, it is essential to consider the implications carefully.",
      "This is just a test. Nothing more to it, really."
    );
    for (const side of [comparison.original, comparison.humanized]) {
      assert.ok(side.score >= 0 && side.score <= 100);
    }
    assert.equal(
      comparison.difference,
      comparison.original.score - comparison.humanized.score
    );
  });

  it("handles empty input on either side without throwing", () => {
    assert.doesNotThrow(() => compareAILikelihood("", ""));
    assert.doesNotThrow(() => compareAILikelihood("Some text here.", ""));
    assert.doesNotThrow(() => compareAILikelihood("", "Some text here."));
  });
});

describe("summaries", () => {
  it("exposes only the values the UI renders", () => {
    const summary = toSummary(buildComparison(result(82), result(31)));
    assert.deepEqual(Object.keys(summary).sort(), [
      "difference",
      "humanizedLabel",
      "humanizedScore",
      "interpretation",
      "lowConfidence",
      "originalLabel",
      "originalScore",
    ]);
    assert.equal(summary.originalScore, 82);
    assert.equal(summary.humanizedScore, 31);
    assert.equal(summary.difference, 51);
  });

  it("propagates low confidence from either side", () => {
    assert.equal(toSummary(buildComparison(result(50, true), result(50))).lowConfidence, true);
    assert.equal(toSummary(buildComparison(result(50), result(50, true))).lowConfidence, true);
    assert.equal(toSummary(buildComparison(result(50), result(50))).lowConfidence, false);
  });
});

describe("historical records without AI-likelihood data", () => {
  it("returns null rather than fabricating a zero score", () => {
    assert.equal(summaryFromStoredScores(null, null), null);
    assert.equal(summaryFromStoredScores(undefined, undefined), null);
    assert.equal(summaryFromStoredScores(82, null), null);
    assert.equal(summaryFromStoredScores(null, 31), null);
    assert.equal(summaryFromStoredScores(82, undefined), null);
  });

  it("rejects non-finite stored values", () => {
    assert.equal(summaryFromStoredScores(Number.NaN, 31), null);
    assert.equal(summaryFromStoredScores(82, Number.POSITIVE_INFINITY), null);
  });

  it("rebuilds a usable summary when both scores are present", () => {
    const summary = summaryFromStoredScores(82, 31);
    assert.ok(summary);
    assert.equal(summary.originalScore, 82);
    assert.equal(summary.humanizedScore, 31);
    assert.equal(summary.difference, 51);
    assert.equal(summary.interpretation, "significant_reduction");
    assert.equal(summary.originalLabel, "High");
    assert.equal(summary.humanizedLabel, "Low");
  });

  it("accepts a legitimately stored zero", () => {
    // 0 is a real score, not missing data — the null check must not treat it as absent.
    const summary = summaryFromStoredScores(0, 0);
    assert.ok(summary);
    assert.equal(summary.difference, 0);
    assert.equal(summary.interpretation, "minimal_change");
  });
});
