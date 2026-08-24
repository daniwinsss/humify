/**
 * Deterministic sentence- and paragraph-shape measurements.
 *
 * Supporting input to the uniformity and structural signals. This does NOT replace
 * the Gemini-derived `sentenceComplexity` field in the writing dashboard.
 */

import { coefficientOfVariation, mean, splitSentences, stdev, type TextStats } from "./text-stats";

export interface ComplexityStats {
  avgSentenceLength: number;
  sentenceLengthStdev: number;
  /** Length-independent spread of sentence lengths. Higher = more varied. */
  sentenceLengthCv: number;
  longestSentence: number;
  /** Length-independent spread of paragraph word counts. */
  paragraphLengthCv: number;
  /** Length-independent spread of sentences-per-paragraph. */
  sentencesPerParagraphCv: number;
}

export function computeComplexity(stats: TextStats): ComplexityStats {
  const { sentenceLengths, paragraphs } = stats;

  const paragraphWordCounts = paragraphs.map(
    (p) => (p.match(/[\p{L}\p{N}]+/gu) ?? []).length
  );
  const sentencesPerParagraph = paragraphs.map((p) => splitSentences(p).length);

  return {
    avgSentenceLength: Number(mean(sentenceLengths).toFixed(1)),
    sentenceLengthStdev: Number(stdev(sentenceLengths).toFixed(2)),
    sentenceLengthCv: coefficientOfVariation(sentenceLengths),
    longestSentence: sentenceLengths.length > 0 ? Math.max(...sentenceLengths) : 0,
    paragraphLengthCv: coefficientOfVariation(paragraphWordCounts),
    sentencesPerParagraphCv: coefficientOfVariation(sentencesPerParagraph),
  };
}
