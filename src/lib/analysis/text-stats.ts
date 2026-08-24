/**
 * Shared deterministic text statistics.
 *
 * Every function here is pure: same input, same output, no I/O, no randomness.
 * This is the foundation the AI-likelihood signals are built on, so any change
 * here shifts scores across the whole feature.
 */

/** Clamp a number into [min, max], mapping NaN to min so bad math can never leak out. */
export function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Round to an integer in [0, 100]. */
export function toScore(value: number): number {
  return Math.round(clamp(value, 0, 100));
}

/**
 * Split into sentences on terminal punctuation followed by whitespace.
 *
 * Deliberately simple: no abbreviation dictionary, because a lookup table that
 * differs by locale would make scores harder to reason about. "Dr. Smith" counts
 * as two sentences; that bias applies equally to the original and the humanized
 * text, so the before/after delta stays meaningful.
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])[\s\n]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /\p{L}/u.test(s));
}

/** Lowercased word tokens; keeps intra-word apostrophes and hyphens. */
export function splitWords(text: string): string[] {
  const matches = text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu);
  return matches ?? [];
}

/** Paragraphs separated by one or more blank lines. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/u)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && /\p{L}/u.test(p));
}

/** Contiguous n-grams over a token list. */
export function ngrams(tokens: string[], n: number): string[] {
  if (n <= 0 || tokens.length < n) return [];
  const out: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    out.push(tokens.slice(i, i + n).join(" "));
  }
  return out;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Population standard deviation. */
export function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = mean(values.map((v) => (v - m) ** 2));
  return Math.sqrt(variance);
}

/**
 * Coefficient of variation: stdev / mean.
 *
 * Length-independent, which is what lets us compare a 40-word input against its
 * 60-word rewrite without the raw spread misleading us.
 */
export function coefficientOfVariation(values: number[]): number {
  const m = mean(values);
  if (m === 0) return 0;
  return stdev(values) / m;
}

/**
 * Vowel-group syllable estimate.
 *
 * An approximation, not a dictionary lookup. Only used for readability, which is
 * a supporting signal, so the error budget is acceptable.
 */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;

  const trimmed = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/u, "")
    .replace(/^y/u, "");
  const groups = trimmed.match(/[aeiouy]{1,2}/gu);
  return Math.max(1, groups ? groups.length : 1);
}

export interface TextStats {
  text: string;
  sentences: string[];
  words: string[];
  paragraphs: string[];
  /** Word count per sentence, index-aligned with `sentences`. */
  sentenceLengths: number[];
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
}

/**
 * Tokenize once and reuse.
 *
 * Each signal needs the same sentence/word/paragraph splits, so computing them
 * a single time keeps the whole analysis O(n) in the input.
 */
export function computeTextStats(text: string): TextStats {
  const normalized = text.replace(/\r\n/gu, "\n");
  const sentences = splitSentences(normalized);
  const words = splitWords(normalized);
  const paragraphs = splitParagraphs(normalized);

  return {
    text: normalized,
    sentences,
    words,
    paragraphs,
    sentenceLengths: sentences.map((s) => splitWords(s).length).filter((n) => n > 0),
    wordCount: words.length,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
  };
}
