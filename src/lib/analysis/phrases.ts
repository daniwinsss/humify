/**
 * Word and phrase lists used by the predictability signal.
 *
 * Data only, no logic. These lists are English-oriented; see the limitations note
 * in ai-likelihood.ts for what that means for the other supported languages.
 */

/**
 * Formulaic constructions that appear disproportionately in generated prose.
 *
 * Presence alone proves nothing — humans write these too. The signal measures
 * *density*, not occurrence.
 */
export const FORMULAIC_PHRASES: readonly string[] = [
  "it is important to note",
  "it is important to understand",
  "it is worth noting",
  "it should be noted",
  "in today's world",
  "in today's fast-paced",
  "in the modern world",
  "in conclusion",
  "in summary",
  "to summarize",
  "delve into",
  "dive into",
  "navigate the complexities",
  "navigating the complexities",
  "plays a crucial role",
  "plays a vital role",
  "plays a significant role",
  "a wide range of",
  "a wide variety of",
  "when it comes to",
  "the realm of",
  "in the realm of",
  "shed light on",
  "pave the way",
  "at the end of the day",
  "it is essential to",
  "it is crucial to",
  "there are several",
  "one of the most",
  "not only that",
  "as a result",
  "by leveraging",
  "harness the power",
  "unlock the potential",
  "a testament to",
  "underscores the importance",
  "highlights the importance",
  "cannot be overstated",
  "rich tapestry",
  "ever-evolving",
  "ever-changing landscape",
  "significant margin",
  "various organizational",
  "careful consideration",
  "comprehensive understanding",
  "wide array of",
];

/** Discourse connectives. Heavy, evenly-spread use reads as machine-structured. */
export const TRANSITION_WORDS: readonly string[] = [
  "however",
  "moreover",
  "furthermore",
  "additionally",
  "consequently",
  "therefore",
  "thus",
  "nevertheless",
  "nonetheless",
  "subsequently",
  "accordingly",
  "hence",
  "meanwhile",
  "similarly",
  "likewise",
  "conversely",
  "notably",
  "specifically",
  "particularly",
  "essentially",
  "ultimately",
  "overall",
  "indeed",
  "firstly",
  "secondly",
  "thirdly",
  "finally",
];

/**
 * Contraction forms.
 *
 * Sparse contractions correlate with formal, machine-like register. Matched as
 * whole tokens against the tokenizer output, which preserves apostrophes.
 */
export const CONTRACTIONS: readonly string[] = [
  "don't", "doesn't", "didn't", "won't", "wouldn't", "can't", "couldn't",
  "shouldn't", "isn't", "aren't", "wasn't", "weren't", "haven't", "hasn't",
  "hadn't", "it's", "that's", "there's", "here's", "what's", "let's", "i'm",
  "you're", "we're", "they're", "i've", "you've", "we've", "they've", "i'll",
  "you'll", "we'll", "they'll", "he's", "she's", "i'd", "you'd", "we'd",
  "they'd", "ain't", "y'all",
];

/** Marks that signal an expressive, less uniform voice. */
export const EXPRESSIVE_PUNCTUATION = /[;:—–()?!"'“”‘’]/gu;
