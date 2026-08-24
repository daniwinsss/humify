/**
 * Deterministic register measurements.
 *
 * Supporting input to the AI-likelihood predictability signal. This does NOT
 * replace the Gemini-derived `formality` field in the writing dashboard.
 */

import type { TextStats } from "./text-stats";
import { CONTRACTIONS, EXPRESSIVE_PUNCTUATION } from "./phrases";

const CONTRACTION_SET = new Set<string>(CONTRACTIONS);

/** Apostrophe variants are normalized so “don’t” and "don't" count alike. */
function normalizeApostrophes(word: string): string {
  return word.replace(/[’‘]/gu, "'");
}

export interface FormalityStats {
  /** Contractions per 100 words. */
  contractionRate: number;
  /** First- and second-person pronouns per 100 words. */
  personalPronounRate: number;
  /** Expressive punctuation marks per 100 words. */
  expressivePunctuationRate: number;
}

const PERSONAL_PRONOUNS = new Set([
  "i", "me", "my", "mine", "myself",
  "we", "us", "our", "ours", "ourselves",
  "you", "your", "yours", "yourself", "yourselves",
]);

export function computeFormality(stats: TextStats): FormalityStats {
  const { words, wordCount, text } = stats;

  if (wordCount === 0) {
    return { contractionRate: 0, personalPronounRate: 0, expressivePunctuationRate: 0 };
  }

  const per100 = 100 / wordCount;

  const contractions = words.filter((w) =>
    CONTRACTION_SET.has(normalizeApostrophes(w))
  ).length;
  const pronouns = words.filter((w) => PERSONAL_PRONOUNS.has(w)).length;
  const punctuation = (text.match(EXPRESSIVE_PUNCTUATION) ?? []).length;

  return {
    contractionRate: contractions * per100,
    personalPronounRate: pronouns * per100,
    expressivePunctuationRate: punctuation * per100,
  };
}
