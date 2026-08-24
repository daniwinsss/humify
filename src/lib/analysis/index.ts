/**
 * Public surface of the analysis module.
 *
 * Consumers (API routes, evaluation scripts, UI) import from here. The individual
 * signal implementations stay internal so the scoring method can be retuned
 * without touching call sites.
 */

export { analyzeAILikelihood, labelForScore } from "./ai-likelihood";
export {
  buildComparison,
  compareAILikelihood,
  interpretDifference,
  shouldAcceptRefinement,
  summaryFromStoredScores,
  toSummary,
} from "./evaluator";
export { AI_LIKELIHOOD_THRESHOLDS, AI_LIKELIHOOD_WEIGHTS } from "./config";
