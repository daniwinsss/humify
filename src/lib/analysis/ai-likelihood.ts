/**
 * AI-likelihood estimator.
 *
 * ## What this is
 *
 * A deterministic, reproducible measurement of writing patterns that tend to
 * correlate with machine-generated prose: uniform sentence lengths, repeated
 * n-grams, narrow vocabulary, formulaic phrasing, and evenly-shaped paragraphs.
 *
 * ## What this is NOT
 *
 * This is NOT an AI detector and it cannot establish authorship. A high score
 * means "this text has the shape of formulaic writing" — which describes plenty
 * of careful human technical, legal, and academic prose. A low score does not
 * mean the text will evade any third-party detector, and nothing in this codebase
 * should claim otherwise. Present the output as an estimate, always.
 *
 * ## Method
 *
 *   score = clamp(round(sum of weight_i * signal_i), 0, 100)
 *
 * Each signal is normalized to 0-100 where higher means more machine-like. The
 * weights and every calibration constant live in ./config.ts — there are no magic
 * numbers in this file.
 *
 * No LLM is involved. The same input always produces the same score, which is
 * what makes a before/after comparison meaningful.
 */

import type {
  AILikelihoodLabel,
  AILikelihoodResult,
  AILikelihoodSignals,
} from "@/types";
import {
  AI_LIKELIHOOD_THRESHOLDS,
  AI_LIKELIHOOD_WEIGHTS,
  SIGNAL_CALIBRATION,
} from "./config";
import { computeComplexity } from "./complexity";
import { computeFormality } from "./formality";
import {
  clamp,
  computeTextStats,
  ngrams,
  toScore,
  type TextStats,
} from "./text-stats";
import { FORMULAIC_PHRASES, TRANSITION_WORDS } from "./phrases";

/**
 * Map a measurement onto 0-100 by how far it sits between two reference points.
 *
 * When `atFloor` > `atCeiling` the scale inverts, which is how "more variation
 * means less machine-like" signals are expressed.
 */
function normalize(value: number, atFloor: number, atCeiling: number): number {
  if (atFloor === atCeiling) return 0;
  const ratio = (value - atFloor) / (atCeiling - atFloor);
  return clamp(ratio * 100, 0, 100);
}

/** Uniform sentence lengths read as machine-like; varied lengths read as human. */
function sentenceUniformitySignal(stats: TextStats): number {
  if (stats.sentenceLengths.length < 2) return 0;
  const { sentenceLengthCv } = computeComplexity(stats);
  // Full variation (CV >= humanSentenceCv) -> 0. No variation (CV = 0) -> 100.
  return normalize(sentenceLengthCv, SIGNAL_CALIBRATION.humanSentenceCv, 0);
}

/** Repeated phrases and repeated sentence openers. */
function repetitionSignal(stats: TextStats): number {
  const { words, sentences } = stats;
  if (words.length < 8) return 0;

  const repeatedRate = (n: number): number => {
    const grams = ngrams(words, n);
    if (grams.length === 0) return 0;
    const counts = new Map<string, number>();
    for (const g of grams) counts.set(g, (counts.get(g) ?? 0) + 1);
    let repeated = 0;
    for (const count of counts.values()) if (count > 1) repeated += count - 1;
    return repeated / grams.length;
  };

  // Bigrams catch phrasing tics; trigrams catch whole reused clauses.
  const phraseRate = (repeatedRate(2) + repeatedRate(3)) / 2;

  // Sentences that all start the same way are a strong structural tell.
  let openerRate = 0;
  if (sentences.length >= 3) {
    const openers = new Map<string, number>();
    for (const s of sentences) {
      const match = s.match(/[\p{L}\p{N}]+/u);
      const first = match ? match[0].toLowerCase() : "";
      if (first) openers.set(first, (openers.get(first) ?? 0) + 1);
    }
    let repeated = 0;
    for (const count of openers.values()) if (count > 1) repeated += count - 1;
    openerRate = repeated / sentences.length;
  }

  const phraseScore = normalize(phraseRate, 0, SIGNAL_CALIBRATION.highRepetitionRate);
  const openerScore = clamp(openerRate * 100, 0, 100);
  return phraseScore * 0.65 + openerScore * 0.35;
}

/**
 * Vocabulary variety, measured with MATTR.
 *
 * A moving-average type-token ratio is used instead of a plain TTR because plain
 * TTR falls as text gets longer, which would make long text look machine-like for
 * no reason other than its length.
 */
function lexicalDiversitySignal(stats: TextStats): number {
  const { words } = stats;
  if (words.length < 10) return 0;

  const window = Math.min(SIGNAL_CALIBRATION.mattrWindow, words.length);
  let ratioSum = 0;
  let windows = 0;
  for (let i = 0; i + window <= words.length; i++) {
    ratioSum += new Set(words.slice(i, i + window)).size / window;
    windows++;
  }
  const mattr = windows > 0 ? ratioSum / windows : new Set(words).size / words.length;

  // High diversity -> 0. Low diversity -> 100.
  return normalize(
    mattr,
    SIGNAL_CALIBRATION.humanLexicalDiversity,
    SIGNAL_CALIBRATION.lowLexicalDiversity
  );
}

/** Formulaic phrasing, heavy connectives, formal register, flat punctuation. */
function predictabilitySignal(stats: TextStats): number {
  const { words, wordCount, text } = stats;
  if (wordCount < 5) return 0;

  const haystack = ` ${text
    .toLowerCase()
    .replace(/[‘’]/gu, "'")
    .replace(/\s+/gu, " ")} `;

  let formulaicHits = 0;
  for (const phrase of FORMULAIC_PHRASES) {
    let from = 0;
    for (;;) {
      const at = haystack.indexOf(phrase, from);
      if (at === -1) break;
      formulaicHits++;
      from = at + phrase.length;
    }
  }

  const transitionSet = new Set<string>(TRANSITION_WORDS);
  const transitionHits = words.filter((w) => transitionSet.has(w)).length;

  const per100 = 100 / wordCount;
  const formality = computeFormality(stats);

  const formulaicScore = normalize(
    formulaicHits * per100,
    0,
    SIGNAL_CALIBRATION.highFormulaicPer100
  );
  const transitionScore = normalize(
    transitionHits * per100,
    0,
    SIGNAL_CALIBRATION.highTransitionPer100
  );
  // Few contractions -> formal register -> more machine-like.
  const contractionScore = normalize(
    formality.contractionRate,
    SIGNAL_CALIBRATION.humanContractionPer100,
    0
  );
  // Flat punctuation -> monotone voice -> more machine-like.
  const punctuationScore = normalize(
    formality.expressivePunctuationRate,
    SIGNAL_CALIBRATION.humanPunctuationPer100,
    0
  );

  return (
    formulaicScore * 0.4 +
    transitionScore * 0.25 +
    contractionScore * 0.2 +
    punctuationScore * 0.15
  );
}

/** Paragraphs of near-identical size and sentence count. */
function structuralPatternsSignal(stats: TextStats): number {
  if (stats.paragraphCount < 2) {
    // A single block gives us no paragraph rhythm to measure. Fall back to how
    // evenly sentences are sized rather than inventing a structural verdict.
    return sentenceUniformitySignal(stats) * 0.5;
  }
  const { paragraphLengthCv, sentencesPerParagraphCv } = computeComplexity(stats);
  const lengthScore = normalize(paragraphLengthCv, SIGNAL_CALIBRATION.humanParagraphCv, 0);
  const countScore = normalize(
    sentencesPerParagraphCv,
    SIGNAL_CALIBRATION.humanParagraphCv,
    0
  );
  return lengthScore * 0.6 + countScore * 0.4;
}

/** Band a 0-100 score into its plain-language label. */
export function labelForScore(score: number): AILikelihoodLabel {
  const { bands } = AI_LIKELIHOOD_THRESHOLDS;
  if (score < bands.low) return "Low";
  if (score < bands.moderate) return "Moderate";
  return "High";
}

/** Confidence reflects how much text we had to measure — not correctness. */
function confidenceFor(wordCount: number): number {
  const { minWordsForAnalysis, fullConfidenceWords } = AI_LIKELIHOOD_THRESHOLDS;
  if (wordCount <= minWordsForAnalysis) {
    return toScore((wordCount / Math.max(1, minWordsForAnalysis)) * 30);
  }
  const span = fullConfidenceWords - minWordsForAnalysis;
  const progress = (wordCount - minWordsForAnalysis) / Math.max(1, span);
  return toScore(30 + clamp(progress, 0, 1) * 70);
}

function explain(signals: AILikelihoodSignals, wordCount: number): string[] {
  const notes: string[] = [];

  if (wordCount === 0) {
    notes.push("No text to analyze.");
    return notes;
  }
  if (wordCount < AI_LIKELIHOOD_THRESHOLDS.minWordsForAnalysis) {
    notes.push(
      `Only ${wordCount} word${wordCount === 1 ? "" : "s"} of text — too short for a reliable estimate.`
    );
  }

  const described: [keyof AILikelihoodSignals, string, string][] = [
    [
      "sentenceUniformity",
      "Sentence lengths are highly uniform.",
      "Sentence lengths vary naturally.",
    ],
    [
      "repetition",
      "Phrases and sentence openers repeat often.",
      "Little phrase repetition detected.",
    ],
    ["lexicalDiversity", "Vocabulary range is narrow.", "Vocabulary is varied."],
    [
      "predictability",
      "Formulaic phrasing and heavy connectives detected.",
      "Phrasing looks varied and idiomatic.",
    ],
    [
      "structuralPatterns",
      "Paragraphs are unusually even in shape.",
      "Paragraph structure varies.",
    ],
  ];

  for (const [key, high, low] of described) {
    const value = signals[key];
    if (value >= 65) notes.push(high);
    else if (value <= 25) notes.push(low);
  }

  if (notes.length === 0) notes.push("Mixed signals — no single pattern dominates.");
  return notes;
}

/**
 * Estimate how machine-like a piece of text reads.
 *
 * Safe on empty, whitespace-only, and very short input: those return a neutral
 * score with `lowConfidence` set rather than throwing.
 */
export function analyzeAILikelihood(text: string): AILikelihoodResult {
  const source = typeof text === "string" ? text : "";
  const stats = computeTextStats(source);

  if (stats.wordCount === 0) {
    return {
      score: 0,
      label: "Low",
      confidence: 0,
      lowConfidence: true,
      signals: {
        repetition: 0,
        sentenceUniformity: 0,
        lexicalDiversity: 0,
        predictability: 0,
        structuralPatterns: 0,
      },
      explanation: ["No text to analyze."],
    };
  }

  const signals: AILikelihoodSignals = {
    sentenceUniformity: toScore(sentenceUniformitySignal(stats)),
    repetition: toScore(repetitionSignal(stats)),
    lexicalDiversity: toScore(lexicalDiversitySignal(stats)),
    predictability: toScore(predictabilitySignal(stats)),
    structuralPatterns: toScore(structuralPatternsSignal(stats)),
  };

  const weighted =
    signals.sentenceUniformity * AI_LIKELIHOOD_WEIGHTS.sentenceUniformity +
    signals.repetition * AI_LIKELIHOOD_WEIGHTS.repetition +
    signals.lexicalDiversity * AI_LIKELIHOOD_WEIGHTS.lexicalDiversity +
    signals.predictability * AI_LIKELIHOOD_WEIGHTS.predictability +
    signals.structuralPatterns * AI_LIKELIHOOD_WEIGHTS.structuralPatterns;

  const score = toScore(weighted);

  return {
    score,
    label: labelForScore(score),
    confidence: confidenceFor(stats.wordCount),
    lowConfidence: stats.wordCount < AI_LIKELIHOOD_THRESHOLDS.minWordsForAnalysis,
    signals,
    explanation: explain(signals, stats.wordCount),
  };
}
