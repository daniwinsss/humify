import type { Style, Language, WritingProfile, RewriteEntry, AILikelihoodSignals } from "@/types";
import { REFINEMENT_SIGNAL_TRIGGERS } from "@/lib/analysis/config";

export const stylePrompts: Record<Style, string> = {
  professional:
    "You are an expert editor. Rewrite the following text to sound natural, polished, and professional. Preserve the original meaning, facts, and structure. Use clear, confident language appropriate for business communication. Do not add new information or change the intent. Return only the rewritten text with no preamble or explanation.",

  casual:
    "You are an expert editor. Rewrite the following text to sound natural, relaxed, and conversational. Preserve the original meaning and facts. Use everyday language, contractions, and a friendly tone as if speaking to a friend. Do not add new information or change the intent. Return only the rewritten text with no preamble or explanation.",

  academic:
    "You are an expert academic editor. Rewrite the following text to sound natural and scholarly. Preserve the original meaning, facts, and logical structure. Use precise vocabulary, formal tone, and well-constructed sentences appropriate for academic papers. Do not add new information or change the intent. Return only the rewritten text with no preamble or explanation.",

  friendly:
    "You are an expert editor. Rewrite the following text to sound natural, warm, and approachable. Preserve the original meaning and facts. Use an encouraging, personable tone with accessible language. Do not add new information or change the intent. Return only the rewritten text with no preamble or explanation.",
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German",
  pt: "Portuguese", it: "Italian", nl: "Dutch", ru: "Russian",
  zh: "Chinese", ja: "Japanese", ko: "Korean", ar: "Arabic",
  hi: "Hindi", tr: "Turkish",
};

export function buildLanguageInstruction(language: Language): string {
  if (language === "auto") {
    return " Output the rewritten text in the same language as the input.";
  }
  return ` Output the rewritten text in ${LANGUAGE_NAMES[language] || language}.`;
}

export function buildProfilePrompt(profile: WritingProfile): string {
  const formalityLabel =
    profile.formality <= 20 ? "very informal" :
    profile.formality <= 40 ? "informal" :
    profile.formality <= 60 ? "neutral" :
    profile.formality <= 80 ? "formal" :
    "very formal";

  let prompt = `You are an expert editor. Rewrite the following text to sound natural and human. Use a ${profile.tone} tone with ${formalityLabel} formality. Preserve the original meaning and facts. Do not add new information or change the intent.`;

  if (profile.custom_instructions) {
    prompt += ` Additional instructions: ${profile.custom_instructions}`;
  }

  prompt += " Return only the rewritten text with no preamble or explanation.";
  return prompt;
}

export function buildFeedbackExamples(examples: RewriteEntry[]): string {
  if (examples.length === 0) return "";
  let section = "\n\nHere are examples of rewrites the user liked:\n";
  for (const ex of examples) {
    section += `\nInput: "${ex.original.slice(0, 200)}"\nGood output: "${ex.rewritten.slice(0, 200)}"\n`;
  }
  section += "\nMatch the style and quality of these examples.";
  return section;
}

/** Hard bounds on refinement feedback. */
const MAX_REFINEMENT_SUGGESTIONS = 5;
const MAX_SUGGESTION_CHARS = 300;

/**
 * Instructions for a second (or later) humanization pass.
 *
 * The suggestions come from the analysis of the PREVIOUS pass's output, so this
 * is what turns repeated rewriting into refinement rather than a reroll.
 *
 * The values originate from model output and are being fed back into a prompt,
 * so they are bounded and filtered rather than trusted verbatim.
 *
 * No meaning-preservation clause is added here: every style prompt and
 * buildProfilePrompt already instructs the model to preserve meaning and facts,
 * and that base prompt still leads a refinement pass.
 */
export function buildRefinementPrompt(suggestions: string[]): string {
  if (!Array.isArray(suggestions)) return "";

  const cleaned = suggestions
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, MAX_REFINEMENT_SUGGESTIONS)
    .map((s) =>
      s.length > MAX_SUGGESTION_CHARS ? `${s.slice(0, MAX_SUGGESTION_CHARS)}...` : s
    );

  if (cleaned.length === 0) return "";

  let section =
    "\n\nThis text has already been rewritten once. A writing analysis flagged the following improvements. Apply them while still preserving the original meaning and facts:\n";
  for (const suggestion of cleaned) {
    section += `- ${suggestion}\n`;
  }
  section +=
    "\nMake these changes directly in the rewritten text. Do not mention, list, or explain the changes.";
  return section;
}

/**
 * Turns the measured AI-likelihood signals into targeted rewrite instructions.
 *
 * Why this exists: the analysis `suggestions` are generated for *naturalness* and
 * in practice often advise making the prose more polished and authoritative —
 * which pushes it back toward the formal, uniform register the estimator scores
 * as machine-like. Observed in testing: a suggestions-only refine pass moved a
 * text from 25 to 28. This block targets what the score actually measures, so
 * the two inputs pull in the same direction instead of against each other.
 *
 * Computed locally from deterministic signals — no extra model call.
 */
export function buildSignalGuidance(signals: AILikelihoodSignals): string {
  const t = REFINEMENT_SIGNAL_TRIGGERS;
  const fixes: string[] = [];

  if (signals.sentenceUniformity >= t.sentenceUniformity) {
    fixes.push(
      "Vary sentence length far more — mix short, punchy sentences with longer ones instead of keeping an even rhythm."
    );
  }
  if (signals.predictability >= t.predictability) {
    fixes.push(
      "Cut formulaic connectives (however, moreover, furthermore, additionally, consequently) and stock phrases; use contractions and plain, direct wording."
    );
  }
  if (signals.repetition >= t.repetition) {
    fixes.push(
      "Stop repeating the same phrases and sentence openers; start consecutive sentences differently."
    );
  }
  if (signals.lexicalDiversity >= t.lexicalDiversity) {
    fixes.push("Broaden the word choice rather than reusing the same vocabulary.");
  }
  if (signals.structuralPatterns >= t.structuralPatterns) {
    fixes.push("Vary paragraph length instead of keeping every paragraph the same size.");
  }

  if (fixes.length === 0) return "";

  let section = "\n\nThe current text still reads as machine-written. Fix these specific patterns:\n";
  for (const fix of fixes) {
    section += `- ${fix}\n`;
  }
  // Counteracts the "make it more polished" pull of the analysis suggestions.
  section +=
    "\nDo not make the wording more formal, more polished, or more authoritative. Favour natural, uneven, human phrasing. Keep the meaning and facts unchanged.";
  return section;
}
