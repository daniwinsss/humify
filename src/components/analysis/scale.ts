/**
 * Shared color scale for AI-likelihood displays.
 *
 * INVERTED relative to ScoreBar: that component treats a high score as good and
 * paints it green. For AI-likelihood a high score is the concerning direction, so
 * the scale is flipped here rather than changing the shared component and
 * breaking every other metric's meaning.
 *
 * Band boundaries mirror AI_LIKELIHOOD_THRESHOLDS.bands.
 */

export const AI_LIKELIHOOD_DISCLAIMER =
  "This score is an estimate based on detected writing patterns and should not be considered definitive proof of AI or human authorship.";

export function aiLikelihoodBarColor(score: number): string {
  if (score >= 67) return "bg-red-500";
  if (score >= 34) return "bg-amber-500";
  return "bg-emerald-500";
}

export function aiLikelihoodTextColor(score: number): string {
  if (score >= 67) return "text-red-600 dark:text-red-400";
  if (score >= 34) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}
