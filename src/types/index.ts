export type Style = "professional" | "casual" | "academic" | "friendly";

export type Language =
  | "auto"
  | "en"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "it"
  | "nl"
  | "ru"
  | "zh"
  | "ja"
  | "ko"
  | "ar"
  | "hi"
  | "tr";

export const LANGUAGE_LABELS: Record<Language, string> = {
  auto: "Auto-detect",
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  it: "Italian",
  nl: "Dutch",
  ru: "Russian",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  ar: "Arabic",
  hi: "Hindi",
  tr: "Turkish",
};

export interface RewriteEntry {
  id: number;
  original: string;
  rewritten: string;
  style: Style;
  language: Language;
  created_at: string;
  /**
   * AI-likelihood estimates recorded at rewrite time.
   *
   * Null on every record created before this feature shipped, and on any rewrite
   * where scoring was skipped. Consumers must treat null as "not measured" rather
   * than as a zero score.
   */
  ai_likelihood_original?: number | null;
  ai_likelihood_humanized?: number | null;
  ai_likelihood_difference?: number | null;
}

export type FeedbackRating = "positive" | "negative";

export interface Feedback {
  id: number;
  rewrite_id: number;
  rating: FeedbackRating;
  created_at: string;
}

export interface WritingProfile {
  id: number;
  name: string;
  description: string;
  tone: string;
  formality: number;
  custom_instructions: string;
  created_at: string;
}

export interface ApiKey {
  id: number;
  key: string;
  name: string;
  created_at: string;
  last_used: string | null;
}

export interface TextAnalysis {
  readability: {
    score: number;
    grade: string;
    label: string;
  };
  formality: {
    score: number;
    label: string;
  };
  emotion: {
    primary: string;
    confidence: number;
    tones: { name: string; score: number }[];
  };
  sentenceComplexity: {
    score: number;
    label: string;
    avgLength: number;
    longestSentence: number;
  };
  suggestions: string[];
  /** Deterministic, locally computed. Optional so older payloads stay valid. */
  aiLikelihood?: AILikelihoodResult;
}

/**
 * AI-likelihood is a probabilistic ESTIMATE derived from measurable writing
 * patterns. It is never evidence of authorship. Any UI that renders these values
 * must say so — see src/components/analysis/AILikelihoodComparison.tsx.
 */
export type AILikelihoodLabel = "Low" | "Moderate" | "High";

export interface AILikelihoodSignals {
  repetition: number;
  sentenceUniformity: number;
  lexicalDiversity: number;
  predictability: number;
  structuralPatterns: number;
}

export interface AILikelihoodResult {
  /** 0-100. 0 = low AI-likelihood estimate, 100 = high. */
  score: number;
  label: AILikelihoodLabel;
  /** 0-100. How much text there was to measure, not how correct the score is. */
  confidence: number;
  /** True when the input was too short for the estimate to mean much. */
  lowConfidence: boolean;
  signals: AILikelihoodSignals;
  /** Plain-language notes about what drove the score. */
  explanation: string[];
}

export type AILikelihoodInterpretation =
  | "significant_reduction"
  | "minimal_change"
  | "increase";

export interface AILikelihoodComparison {
  original: AILikelihoodResult;
  humanized: AILikelihoodResult;
  /** original.score - humanized.score. Positive means the estimate went down. */
  difference: number;
  improved: boolean;
  interpretation: AILikelihoodInterpretation;
}

/**
 * The minimal shape the comparison UI needs.
 *
 * Signals and explanations stay server-side: the interface only ever receives the
 * numbers it renders. This also lets history entries — which persist scores but
 * not signals — reuse the same component without fabricating missing data.
 */
export interface AILikelihoodSummary {
  originalScore: number;
  humanizedScore: number;
  originalLabel: AILikelihoodLabel;
  humanizedLabel: AILikelihoodLabel;
  /** originalScore - humanizedScore. Positive means the estimate went down. */
  difference: number;
  interpretation: AILikelihoodInterpretation;
  /** True when either text was too short for the estimate to mean much. */
  lowConfidence: boolean;
}

/**
 * One humanization pass in a refinement chain.
 *
 * `accepted` is false when the pass raised the estimate and the previous, better
 * text was kept instead. Recorded rather than hidden so the user can see that the
 * attempt happened and what it cost.
 */
export interface RefinePass {
  pass: number;
  before: number;
  after: number;
  accepted: boolean;
}
