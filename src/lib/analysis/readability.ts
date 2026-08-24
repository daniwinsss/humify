/**
 * Deterministic readability metrics.
 *
 * These feed the AI-likelihood estimate as a supporting measurement. They do NOT
 * replace the Gemini-derived `readability` field shown in the writing dashboard —
 * that remains the model's own judgement, surfaced separately.
 */

import { clamp, countSyllables, type TextStats } from "./text-stats";

export interface ReadabilityStats {
  /** Flesch Reading Ease, clamped to 0-100. Higher = easier to read. */
  fleschReadingEase: number;
  /** Flesch-Kincaid grade level, floored at 0. */
  gradeLevel: number;
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
}

export function computeReadability(stats: TextStats): ReadabilityStats {
  const { words, sentenceCount, wordCount } = stats;

  if (wordCount === 0 || sentenceCount === 0) {
    return {
      fleschReadingEase: 0,
      gradeLevel: 0,
      avgWordsPerSentence: 0,
      avgSyllablesPerWord: 0,
    };
  }

  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgWordsPerSentence = wordCount / sentenceCount;
  const avgSyllablesPerWord = syllables / wordCount;

  const fleschReadingEase =
    206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
  const gradeLevel =
    0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;

  return {
    fleschReadingEase: clamp(fleschReadingEase, 0, 100),
    gradeLevel: Math.max(0, Number(gradeLevel.toFixed(1))),
    avgWordsPerSentence: Number(avgWordsPerSentence.toFixed(1)),
    avgSyllablesPerWord: Number(avgSyllablesPerWord.toFixed(2)),
  };
}
