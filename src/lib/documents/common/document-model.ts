import type { BlockKind, TextBlock, TextRun } from "./types";

const WHITESPACE_SPLIT = /^(\s*)([\s\S]*?)(\s*)$/;

/**
 * Split a raw string into leading whitespace, core text, and trailing whitespace.
 *
 * Models routinely strip or add edge whitespace, so we never send it to Gemini — we keep
 * it here and re-attach it verbatim. That alone removes a whole class of spacing bugs
 * between adjacent runs.
 */
export function splitWhitespace(text: string): { lead: string; core: string; trail: string } {
  const match = WHITESPACE_SPLIT.exec(text);
  if (!match) return { lead: "", core: text, trail: "" };
  return { lead: match[1], core: match[2], trail: match[3] };
}

export function makeRun(id: string, text: string): TextRun {
  const { lead, core, trail } = splitWhitespace(text);
  return { id, core, lead, trail };
}

export function renderRun(run: TextRun, core: string): string {
  return `${run.lead}${core}${run.trail}`;
}

export function makeBlock(id: string, kind: BlockKind, runs: TextRun[]): TextBlock {
  return { id, kind, runs };
}

/** The block's text as a reader would see it, ignoring run boundaries. */
export function blockText(block: TextBlock): string {
  return block.runs.map((r) => `${r.lead}${r.core}${r.trail}`).join("");
}

const URL_ONLY = /^(https?:\/\/|www\.|mailto:|tel:|ftp:\/\/)\S*$/i;
const EMAIL_ONLY = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HAS_LETTER = /\p{L}/u;

/**
 * Whether a piece of text is prose worth rewriting.
 *
 * Bare URLs, email addresses, numbers and punctuation are left exactly as-is — rewriting
 * them would break links and is never what the user wants.
 */
export function isHumanizableText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3) return false;
  if (!HAS_LETTER.test(trimmed)) return false;
  if (URL_ONLY.test(trimmed)) return false;
  if (EMAIL_ONLY.test(trimmed)) return false;
  return true;
}

/**
 * Whether a run must survive byte-for-byte.
 *
 * A URL or email address is often one run inside an otherwise ordinary sentence — link
 * text, typically. The surrounding block is prose and gets rewritten, so protecting it at
 * block level is not enough; the run itself has to be frozen.
 */
export function isFrozenText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  return URL_ONLY.test(trimmed) || EMAIL_ONLY.test(trimmed);
}

export function isFrozenBlockRun(run: TextRun): boolean {
  return isFrozenText(run.core);
}

/** A block is worth sending only if its combined text reads as prose. */
export function isHumanizableBlock(block: TextBlock): boolean {
  if (block.runs.length === 0) return false;
  const combined = block.runs.map((r) => r.core).join(" ").trim();
  return isHumanizableText(combined);
}

export function countRuns(blocks: TextBlock[]): number {
  return blocks.reduce((sum, b) => sum + b.runs.length, 0);
}

export function countChars(blocks: TextBlock[]): number {
  return blocks.reduce(
    (sum, b) => sum + b.runs.reduce((s, r) => s + r.core.length, 0),
    0
  );
}

/** Sequential id generator, so run ids are stable and comparable across a document. */
export function createIdFactory(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}${n++}`;
}
