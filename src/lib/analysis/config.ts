/**
 * Every tunable number for the AI-likelihood estimate lives here.
 *
 * Nothing in this feature hardcodes a threshold or weight anywhere else — tuning
 * the estimator means editing this file and nothing else.
 */

/**
 * Relative contribution of each signal to the final score.
 *
 * Must sum to 1.0 (asserted in tests/ai-likelihood.test.ts).
 *
 * Rationale for the current split: formulaic phrasing and sentence uniformity are
 * the two patterns that separate machine prose from human prose most reliably in
 * manual spot-checks, so they carry the most weight.
 *
 * Lexical diversity is deliberately weighted LOW. It is an intuitive signal but a
 * weak discriminator in practice: generated prose often has perfectly healthy
 * vocabulary range, so a high weight here dragged obvious machine text down toward
 * the middle of the scale. Repetition has the same problem to a lesser degree.
 *
 * These are hand-set starting values, NOT fitted to a labeled corpus.
 */
export const AI_LIKELIHOOD_WEIGHTS = {
  sentenceUniformity: 0.27,
  repetition: 0.13,
  lexicalDiversity: 0.12,
  predictability: 0.3,
  structuralPatterns: 0.18,
} as const;

export type AILikelihoodSignalName = keyof typeof AI_LIKELIHOOD_WEIGHTS;

export const AI_LIKELIHOOD_THRESHOLDS = {
  /** Percentage-point change treated as meaningful rather than noise. */
  significantChange: 10,

  /** Below this word count the estimate is reported but flagged unreliable. */
  minWordsForAnalysis: 15,

  /** Word count at which confidence reaches its maximum. */
  fullConfidenceWords: 200,

  /** Score band boundaries: < low = "Low", < moderate = "Moderate", else "High". */
  bands: {
    low: 34,
    moderate: 67,
  },
} as const;

/**
 * Reference points for normalizing raw measurements onto the 0-100 signal scale.
 *
 * Each value is the measurement at which a signal is considered fully "human-like"
 * (or fully "AI-like"), derived from spot-checking sample prose rather than from a
 * fitted model. Documented so they can be re-tuned deliberately.
 */
export const SIGNAL_CALIBRATION = {
  /** Sentence-length CV at or above which variation reads as fully human. */
  humanSentenceCv: 0.75,

  /** Paragraph-length CV at or above which variation reads as fully human. */
  humanParagraphCv: 0.6,

  /** Window size for the moving-average type-token ratio. */
  mattrWindow: 50,

  /** MATTR at or above which vocabulary reads as fully varied. */
  humanLexicalDiversity: 0.88,

  /** MATTR at or below which vocabulary reads as fully repetitive. */
  lowLexicalDiversity: 0.55,

  /** Repeated-ngram rate at or above which repetition reads as fully machine-like. */
  highRepetitionRate: 0.08,

  /** Formulaic phrase hits per 100 words that reads as fully formulaic. */
  highFormulaicPer100: 2,

  /** Transition-word rate per 100 words that reads as fully transition-heavy. */
  highTransitionPer100: 5,

  /** Contractions per 100 words at or above which the voice reads as fully informal. */
  humanContractionPer100: 3,

  /** Varied punctuation marks per 100 words that reads as fully expressive. */
  humanPunctuationPer100: 4,
} as const;

/**
 * Signal levels at which a refinement pass gets an explicit instruction to fix
 * that pattern.
 *
 * Set below the "high" reporting band (65) so guidance kicks in while a pattern
 * is still merely elevated, rather than waiting until it is severe.
 */
export const REFINEMENT_SIGNAL_TRIGGERS = {
  sentenceUniformity: 50,
  predictability: 50,
  repetition: 45,
  lexicalDiversity: 55,
  structuralPatterns: 55,
} as const;
