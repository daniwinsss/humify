import { rewriteText, getGeminiErrorDetails } from "@/lib/gemini";
import { logger } from "@/lib/logger";
import { isFrozenBlockRun, isHumanizableBlock } from "./document-model";
import { BATCH_CHAR_BUDGET, BATCH_CONCURRENCY } from "./limits";
import type { DocumentWarning, TextBlock, TextRun } from "./types";

/**
 * Rules appended to the user's chosen style prompt. These teach the model the transport
 * format; the style instructions themselves are untouched, so document rewriting produces
 * the same voice as the plain-text path.
 */
const PROTOCOL_INSTRUCTIONS = `

You are rewriting text extracted from a formatted document. The text arrives as one or more blocks. Each block begins with a delimiter line of the form <<<B1>>>, <<<B2>>>, and so on.

Follow these rules exactly:
1. Reproduce every delimiter line exactly as received, in the same order, each on its own line.
2. After each delimiter line, output only the rewritten text for that block.
3. Some blocks contain inline markers such as [[1]] or [[2]]. Each marker is a formatting boundary. Reproduce every marker exactly once, in ascending numeric order, keeping each marker beside the same words it originally bordered.
4. Never add, remove, merge, split, or reorder blocks or markers.
5. Leave URLs, email addresses, file paths, code identifiers, and numbers exactly as they are.
6. Do not use markdown, code fences, preambles, or explanations.`;

const MARKER = (n: number) => `[[${n}]]`;
const MARKER_SPLIT = /\[\[(\d+)\]\]/g;
const DELIMITER = (n: number) => `<<<B${n}>>>`;
const DELIMITER_SPLIT = /^<<<B(\d+)>>>[ \t]*$/gm;
const CODE_FENCE = /^\s*```[a-z]*\s*\n?|\n?```\s*$/gi;

/** Runs with actual text. Whitespace-only runs are never sent and never modified. */
function activeRuns(block: TextBlock): TextRun[] {
  return block.runs.filter((r) => r.core.length > 0);
}

/** Join a block's runs into one string, with `[[n]]` at each formatting boundary. */
export function encodeBlock(block: TextBlock): string {
  const runs = activeRuns(block);
  let out = "";
  runs.forEach((run, i) => {
    if (i > 0) out += MARKER(i);
    out += run.core;
  });
  return out;
}

/**
 * Split a rewritten block back into per-run text.
 *
 * Returns null when the markers came back wrong — missing, duplicated, or out of order —
 * which is the signal to retry or fall back rather than write corrupted output.
 */
export function decodeBlock(block: TextBlock, rewritten: string): string[] | null {
  const runs = activeRuns(block);
  if (runs.length === 0) return null;
  if (runs.length === 1) return [rewritten.trim()];

  const parts: string[] = [];
  const seen: number[] = [];
  let cursor = 0;

  MARKER_SPLIT.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MARKER_SPLIT.exec(rewritten)) !== null) {
    parts.push(rewritten.slice(cursor, match.index));
    seen.push(Number.parseInt(match[1], 10));
    cursor = match.index + match[0].length;
  }
  parts.push(rewritten.slice(cursor));

  // Every boundary must be present exactly once, in ascending order.
  if (seen.length !== runs.length - 1) return null;
  for (let i = 0; i < seen.length; i++) {
    if (seen[i] !== i + 1) return null;
  }

  return parts.map((p) => p.trim());
}

function encodeBatch(blocks: TextBlock[]): string {
  return blocks.map((b, i) => `${DELIMITER(i + 1)}\n${encodeBlock(b)}`).join("\n");
}

/** Pull each block's rewritten text out of the response, keyed by its 1-based index. */
function splitBatchResponse(response: string): Map<number, string> {
  const cleaned = response.replace(CODE_FENCE, "");
  const segments = new Map<number, string>();

  const matches: { index: number; start: number; end: number }[] = [];
  DELIMITER_SPLIT.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DELIMITER_SPLIT.exec(cleaned)) !== null) {
    matches.push({
      index: Number.parseInt(match[1], 10),
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  matches.forEach((m, i) => {
    const stop = i + 1 < matches.length ? matches[i + 1].start : cleaned.length;
    segments.set(m.index, cleaned.slice(m.end, stop).replace(/^\n/, "").replace(/\n$/, ""));
  });

  return segments;
}

/** Pack blocks into batches that stay under the per-request character budget. */
export function batchBlocks(blocks: TextBlock[], budget = BATCH_CHAR_BUDGET): TextBlock[][] {
  const batches: TextBlock[][] = [];
  let current: TextBlock[] = [];
  let size = 0;

  for (const block of blocks) {
    const encoded = encodeBlock(block).length;
    // A single oversized block still goes out alone rather than being dropped.
    if (current.length > 0 && size + encoded > budget) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(block);
    size += encoded;
  }

  if (current.length > 0) batches.push(current);
  return batches;
}

export interface HumanizeBlocksResult {
  /** runId -> rewritten core text. Runs absent from this map keep their original text. */
  replacements: Map<string, string>;
  warnings: DocumentWarning[];
  geminiCalls: number;
  blocksRewritten: number;
  blocksSkipped: number;
}

/** The rewriting call. Matches `rewriteText`; injectable so tests can run offline. */
export type RewriteFn = (text: string, systemPrompt: string) => Promise<string>;

interface HumanizeBlocksOptions {
  /** The composed style/language/profile prompt from the existing prompt builders. */
  systemPrompt: string;
  batchBudget?: number;
  concurrency?: number;
  rewrite?: RewriteFn;
}

/** Run tasks with a bounded number in flight, preserving result order. */
async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let next = 0;

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Humanize a document's blocks, preserving run boundaries.
 *
 * Blocks are batched to keep the number of API calls proportional to document length
 * rather than to fragment count. A batch whose markers come back malformed is retried one
 * block at a time; a block that still fails keeps its original text and raises a warning.
 */
export async function humanizeBlocks(
  blocks: TextBlock[],
  options: HumanizeBlocksOptions
): Promise<HumanizeBlocksResult> {
  const systemPrompt = options.systemPrompt + PROTOCOL_INSTRUCTIONS;
  const rewrite = options.rewrite ?? rewriteText;
  const replacements = new Map<string, string>();
  const warnings: DocumentWarning[] = [];

  const candidates = blocks.filter(isHumanizableBlock);
  const blocksSkipped = blocks.length - candidates.length;

  if (candidates.length === 0) {
    return { replacements, warnings, geminiCalls: 0, blocksRewritten: 0, blocksSkipped };
  }

  const batches = batchBlocks(candidates, options.batchBudget);
  let geminiCalls = 0;
  let blocksRewritten = 0;
  let apiFailures = 0;

  /** Apply a decoded block if it is well-formed. Returns false to trigger a fallback. */
  const applyBlock = (block: TextBlock, rewritten: string): boolean => {
    const decoded = decodeBlock(block, rewritten);
    if (!decoded) return false;

    const runs = activeRuns(block);
    // Refuse a decode that empties a run — that is content loss, not a rewrite.
    if (decoded.some((d) => d.length === 0)) return false;

    runs.forEach((run, i) => {
      // Frozen runs were sent for context only; whatever came back for them is discarded.
      if (isFrozenBlockRun(run)) return;
      replacements.set(run.id, decoded[i]);
    });
    return true;
  };

  /** Last resort for one block: its own request, then give up and keep the original. */
  const retryBlock = async (block: TextBlock): Promise<void> => {
    try {
      geminiCalls++;
      const response = await rewrite(`${DELIMITER(1)}\n${encodeBlock(block)}`, systemPrompt);
      const segment = splitBatchResponse(response).get(1);
      if (segment !== undefined && applyBlock(block, segment)) {
        blocksRewritten++;
        return;
      }
      warnings.push({
        code: "marker-mismatch",
        message:
          "A paragraph could not be rewritten without risking its inline formatting, so its original text was kept.",
        location: block.id,
      });
    } catch (error) {
      apiFailures++;
      const details = getGeminiErrorDetails(error);
      warnings.push({
        code: "api-failure",
        message: details?.message ?? "Gemini failed on a paragraph; its original text was kept.",
        location: block.id,
      });
    }
  };

  const tasks = batches.map((batch) => async () => {
    try {
      geminiCalls++;
      const response = await rewrite(encodeBatch(batch), systemPrompt);
      const segments = splitBatchResponse(response);

      const failed: TextBlock[] = [];
      for (let i = 0; i < batch.length; i++) {
        const segment = segments.get(i + 1);
        if (segment === undefined || !applyBlock(batch[i], segment)) {
          failed.push(batch[i]);
        } else {
          blocksRewritten++;
        }
      }

      for (const block of failed) await retryBlock(block);
    } catch (error) {
      apiFailures++;
      const details = getGeminiErrorDetails(error);
      logger.error("documents.batch.failed", { error: String(error) });
      // One failed batch shouldn't cost the whole document — retry its blocks singly.
      if (batch.length > 1) {
        for (const block of batch) await retryBlock(block);
      } else {
        warnings.push({
          code: "api-failure",
          message: details?.message ?? "Gemini failed on a paragraph; its original text was kept.",
          location: batch[0].id,
        });
      }
    }
  });

  await pool(tasks, options.concurrency ?? BATCH_CONCURRENCY);

  // Nothing rewritten and Gemini was the reason: report it instead of returning a copy.
  if (blocksRewritten === 0 && apiFailures > 0) {
    throw new Error(
      warnings.find((w) => w.code === "api-failure")?.message ??
        "Gemini could not process this document."
    );
  }

  if (blocksSkipped > 0) {
    warnings.push({
      code: "block-skipped",
      message: `${blocksSkipped} block(s) were left unchanged because they contain no prose (for example URLs, numbers, or code).`,
    });
  }

  return { replacements, warnings, geminiCalls, blocksRewritten, blocksSkipped };
}
