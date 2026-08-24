/**
 * Before/after comparison of AI-likelihood estimates.
 *
 * A reduction here is NOT by itself a quality result. Meaning preservation,
 * factual consistency, style adherence, naturalness and readability remain the
 * primary constraints — a rewrite that slashes this estimate while changing what
 * the text says is a failure, not a success. Treat this as one reported metric
 * among several.
 */

import type {
  AILikelihoodComparison,
  AILikelihoodInterpretation,
  AILikelihoodResult,
  AILikelihoodSummary,
} from "@/types";
import { AI_LIKELIHOOD_THRESHOLDS } from "./config";
import { analyzeAILikelihood, labelForScore } from "./ai-likelihood";

/** Classify a percentage-point delta against the configured threshold. */
export function interpretDifference(difference: number): AILikelihoodInterpretation {
  const { significantChange } = AI_LIKELIHOOD_THRESHOLDS;
  if (difference > significantChange) return "significant_reduction";
  if (difference < -significantChange) return "increase";
  return "minimal_change";
}

/**
 * Compare two already-computed estimates.
 *
 * Split out from `compareAILikelihood` so callers holding cached results (for
 * example, scores read back from the database) can build a comparison without
 * re-analyzing the text.
 */
export function buildComparison(
  original: AILikelihoodResult,
  humanized: AILikelihoodResult
): AILikelihoodComparison {
  // Positive difference means the estimate went DOWN after humanizing.
  const difference = original.score - humanized.score;
  const interpretation = interpretDifference(difference);

  return {
    original,
    humanized,
    difference,
    improved: interpretation === "significant_reduction",
    interpretation,
  };
}

/**
 * Analyze both texts and compare them.
 *
 * Deterministic and local: no network call, no LLM, so this adds negligible
 * latency to the rewrite request it runs inside.
 */
export function compareAILikelihood(
  originalText: string,
  humanizedText: string
): AILikelihoodComparison {
  return buildComparison(
    analyzeAILikelihood(originalText),
    analyzeAILikelihood(humanizedText)
  );
}

/** Reduce a full comparison to the values the UI renders. */
export function toSummary(comparison: AILikelihoodComparison): AILikelihoodSummary {
  const { original, humanized, difference, interpretation } = comparison;
  return {
    originalScore: original.score,
    humanizedScore: humanized.score,
    originalLabel: original.label,
    humanizedLabel: humanized.label,
    difference,
    interpretation,
    lowConfidence: original.lowConfidence || humanized.lowConfidence,
  };
}

/**
 * Rebuild a summary from scores read back out of storage.
 *
 * Returns null when either score is missing, which is the normal case for rewrite
 * history created before this feature existed. Callers render nothing rather than
 * showing a zero.
 */
export function summaryFromStoredScores(
  originalScore: number | null | undefined,
  humanizedScore: number | null | undefined
): AILikelihoodSummary | null {
  if (typeof originalScore !== "number" || typeof humanizedScore !== "number") {
    return null;
  }
  if (!Number.isFinite(originalScore) || !Number.isFinite(humanizedScore)) {
    return null;
  }

  const difference = originalScore - humanizedScore;
  return {
    originalScore,
    humanizedScore,
    originalLabel: labelForScore(originalScore),
    humanizedLabel: labelForScore(humanizedScore),
    difference,
    interpretation: interpretDifference(difference),
    // Stored records do not carry the word counts that produced them, so we
    // cannot re-derive confidence. Not claiming low confidence is the honest
    // default here — the caveat text still shows on every rendering.
    lowConfidence: false,
  };
}

/**
 * Whether a refinement pass produced a result worth keeping.
 *
 * Strictly lower only: an equal score means the pass achieved nothing measurable,
 * and swapping the text anyway would churn the user's output for no stated gain.
 *
 * This governs which text is DISPLAYED. It is not a quality verdict — a pass that
 * lowers the estimate while damaging meaning is still a bad rewrite, which is why
 * the meaning-preservation instruction stays in the base prompt.
 */
export function shouldAcceptRefinement(
  currentScore: number,
  candidateScore: number
): boolean {
  if (!Number.isFinite(currentScore) || !Number.isFinite(candidateScore)) return false;
  return candidateScore < currentScore;
}
