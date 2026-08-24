import { logger } from "@/lib/logger";
import { countChars, countRuns, createIdFactory, makeRun } from "./common/document-model";
import { DocumentError } from "./common/errors";
import { MAX_TEXT_CHARS, MIME_TYPES } from "./common/limits";
import { humanizeBlocks, type RewriteFn } from "./common/segment-humanizer";
import type {
  DocumentFormat,
  DocumentResult,
  DocumentWarning,
  PreservationMetric,
  TextBlock,
} from "./common/types";
import { extractDocx } from "./docx/extractor";
import { parseDocx, serializeDocx } from "./docx/parser";
import { applyDocxReplacements } from "./docx/replacer";
import { compareDocx, fingerprintDocx } from "./docx/validator";
import { extractHtml } from "./html/extractor";
import { contentRoot, parseHtml, serializeHtml } from "./html/parser";
import { applyHtmlReplacements } from "./html/replacer";
import { sanitizeForPreview } from "./html/sanitizer";
import { compareHtml, fingerprintHtml } from "./html/validator";
import { buildReport } from "./report";

export interface ProcessInput {
  filename: string;
  format: DocumentFormat;
  buffer: Buffer;
  /** The composed style/language/profile prompt, built by the caller as usual. */
  systemPrompt: string;
  /** Defaults to the input format. `txt` is always available as a fallback. */
  outputFormat?: DocumentFormat;
  /** Overrides the Gemini call. Used by the test suite to run the pipeline offline. */
  rewrite?: RewriteFn;
}

function guardTextSize(blocks: TextBlock[]) {
  const chars = countChars(blocks);
  if (chars > MAX_TEXT_CHARS) {
    throw new DocumentError(
      "file-too-large",
      `This document contains ${chars.toLocaleString()} characters of text, above the ${MAX_TEXT_CHARS.toLocaleString()} limit. Split it into smaller documents and try again.`,
      413
    );
  }
  return chars;
}

function withExtension(filename: string, format: DocumentFormat): string {
  const base = filename.replace(/\.[^.]+$/, "") || "document";
  const ext = format === "html" ? "html" : format === "docx" ? "docx" : "txt";
  return `${base}-humanized.${ext}`;
}

/** Keeps the JSON response a sane size when someone uploads a book. */
const PREVIEW_CHAR_LIMIT = 20_000;

function clampPreview(text: string): string {
  return text.length <= PREVIEW_CHAR_LIMIT
    ? text
    : `${text.slice(0, PREVIEW_CHAR_LIMIT)}\n\n… preview truncated; the downloaded file is complete.`;
}

/** Render blocks as plain text — the `.txt` fallback output for any input format. */
function blocksToText(blocks: TextBlock[], replacements: Map<string, string>): string {
  return blocks
    .map((block) =>
      block.runs
        .map((run) => `${run.lead}${replacements.get(run.id) ?? run.core}${run.trail}`)
        .join("")
        .trim()
    )
    .filter((line) => line.length > 0)
    .join("\n\n");
}

/**
 * Humanize a document's text while leaving its formatting alone.
 *
 * The shape is the same for every format: parse, fingerprint, extract prose, rewrite,
 * write back in place, re-parse the *actual output*, and compare fingerprints. Validating
 * the real output rather than the in-memory tree is what makes the report trustworthy.
 */
export async function processDocument(input: ProcessInput): Promise<DocumentResult> {
  const timer = logger.time("documents.process");
  const outputFormat = input.outputFormat ?? input.format;

  try {
    const result =
      input.format === "html"
        ? await processHtml(input, outputFormat)
        : input.format === "docx"
          ? await processDocx(input, outputFormat)
          : await processTxt(input, outputFormat);

    timer.end({
      format: input.format,
      outputFormat,
      blocks: result.stats.blocks,
      runs: result.stats.runs,
      geminiCalls: result.stats.geminiCalls,
      fullyPreserved: result.report.fullyPreserved,
    });

    return result;
  } catch (error) {
    timer.error({ format: input.format, error: String(error) });
    throw error;
  }
}

async function processHtml(input: ProcessInput, outputFormat: DocumentFormat): Promise<DocumentResult> {
  const source = input.buffer.toString("utf8");
  const parsed = parseHtml(source);
  const before = fingerprintHtml(parsed);
  const extraction = extractHtml(parsed);
  const warnings: DocumentWarning[] = [];

  if (extraction.skippedTags.length > 0) {
    warnings.push({
      code: "block-skipped",
      message: `Left untouched by design: ${extraction.skippedTags.map((t) => `<${t}>`).join(", ")}.`,
    });
  }

  if (extraction.blocks.length === 0) {
    return emptyResult(input, outputFormat, source, warnings, "html", []);
  }

  const charsIn = guardTextSize(extraction.blocks);

  // Snapshot the "before" state while the tree is still untouched.
  const originalText = blocksToText(extraction.blocks, new Map());
  const originalPreviewHtml = sanitizeForPreview(serializeHtml({ ...parsed, root: contentRoot(parsed) }));

  const humanized = await humanizeBlocks(extraction.blocks, { systemPrompt: input.systemPrompt, rewrite: input.rewrite });
  warnings.push(...humanized.warnings);

  const modified = applyHtmlReplacements(extraction, humanized.replacements);
  const textPreview = {
    original: clampPreview(originalText),
    humanized: clampPreview(blocksToText(extraction.blocks, humanized.replacements)),
  };

  if (outputFormat === "txt") {
    const text = blocksToText(extraction.blocks, humanized.replacements);
    return {
      filename: withExtension(input.filename, "txt"),
      mimeType: MIME_TYPES.txt,
      dataBase64: Buffer.from(text, "utf8").toString("base64"),
      report: buildReport("html", modified > 0, [], [
        ...warnings,
        {
          code: "unsupported-element",
          message: "Plain-text output discards all formatting by definition. Choose HTML output to keep it.",
        },
      ]),
      textPreview,
      stats: {
        blocks: extraction.blocks.length,
        runs: countRuns(extraction.blocks),
        charsIn,
        charsOut: text.length,
        geminiCalls: humanized.geminiCalls,
      },
    };
  }

  const output = serializeHtml(parsed);
  // Re-parse what we actually produced, so the report describes the real file.
  const after = fingerprintHtml(parseHtml(output));
  const comparison = compareHtml(before, after);

  return {
    filename: withExtension(input.filename, "html"),
    mimeType: MIME_TYPES.html,
    dataBase64: Buffer.from(output, "utf8").toString("base64"),
    report: buildReport("html", modified > 0, comparison.metrics, [...warnings, ...comparison.warnings]),
    previewHtml: sanitizeForPreview(serializeHtml({ ...parsed, root: contentRoot(parsed) })),
    originalPreviewHtml,
    textPreview,
    stats: {
      blocks: extraction.blocks.length,
      runs: countRuns(extraction.blocks),
      charsIn,
      charsOut: after.textLength,
      geminiCalls: humanized.geminiCalls,
    },
  };
}

async function processDocx(input: ProcessInput, outputFormat: DocumentFormat): Promise<DocumentResult> {
  const parsed = await parseDocx(input.buffer);
  const before = fingerprintDocx(parsed);
  const extraction = extractDocx(parsed);
  const warnings: DocumentWarning[] = extraction.skipped.map((s) => ({
    code: "block-skipped" as const,
    message: s.reason,
    location: s.location,
  }));

  if (extraction.blocks.length === 0) {
    const untouched = await serializeDocx(parsed);
    return emptyResult(input, outputFormat, untouched, warnings, "docx", []);
  }

  const charsIn = guardTextSize(extraction.blocks);
  const originalText = blocksToText(extraction.blocks, new Map());

  const humanized = await humanizeBlocks(extraction.blocks, { systemPrompt: input.systemPrompt, rewrite: input.rewrite });
  warnings.push(...humanized.warnings);

  const modified = applyDocxReplacements(extraction, humanized.replacements);
  const textPreview = {
    original: clampPreview(originalText),
    humanized: clampPreview(blocksToText(extraction.blocks, humanized.replacements)),
  };

  if (outputFormat === "txt") {
    const text = blocksToText(extraction.blocks, humanized.replacements);
    return {
      filename: withExtension(input.filename, "txt"),
      mimeType: MIME_TYPES.txt,
      dataBase64: Buffer.from(text, "utf8").toString("base64"),
      report: buildReport("docx", modified > 0, [], [
        ...warnings,
        {
          code: "unsupported-element",
          message: "Plain-text output discards all formatting by definition. Choose DOCX output to keep it.",
        },
      ]),
      textPreview,
      stats: {
        blocks: extraction.blocks.length,
        runs: countRuns(extraction.blocks),
        charsIn,
        charsOut: text.length,
        geminiCalls: humanized.geminiCalls,
      },
    };
  }

  const output = await serializeDocx(parsed);
  // Re-open the generated .docx and fingerprint that, not the tree we edited.
  const after = fingerprintDocx(await parseDocx(output));
  const comparison = compareDocx(before, after);

  return {
    filename: withExtension(input.filename, "docx"),
    mimeType: MIME_TYPES.docx,
    dataBase64: output.toString("base64"),
    report: buildReport("docx", modified > 0, comparison.metrics, [...warnings, ...comparison.warnings]),
    textPreview,
    stats: {
      blocks: extraction.blocks.length,
      runs: countRuns(extraction.blocks),
      charsIn,
      charsOut: after.textLength,
      geminiCalls: humanized.geminiCalls,
    },
  };
}

async function processTxt(input: ProcessInput, outputFormat: DocumentFormat): Promise<DocumentResult> {
  const source = input.buffer.toString("utf8");
  if (source.trim().length === 0) {
    throw new DocumentError("empty-document", "The document is empty.");
  }

  const nextBlockId = createIdFactory("tb");
  const nextRunId = createIdFactory("tr");
  const blocks: TextBlock[] = source
    .split(/\n{2,}/)
    .filter((p) => p.trim().length > 0)
    .map((p) => ({ id: nextBlockId(), kind: "paragraph" as const, runs: [makeRun(nextRunId(), p)] }));

  const charsIn = guardTextSize(blocks);
  const originalText = blocksToText(blocks, new Map());
  const humanized = await humanizeBlocks(blocks, { systemPrompt: input.systemPrompt, rewrite: input.rewrite });
  const text = blocksToText(blocks, humanized.replacements);
  const format = outputFormat === "txt" ? "txt" : outputFormat;

  return {
    filename: withExtension(input.filename, "txt"),
    mimeType: MIME_TYPES.txt,
    dataBase64: Buffer.from(text, "utf8").toString("base64"),
    report: buildReport("txt", humanized.replacements.size > 0, [], [
      ...humanized.warnings,
      ...(format !== "txt"
        ? [{ code: "unsupported-element" as const, message: "Plain-text input has no formatting to convert; the output is plain text." }]
        : []),
    ]),
    textPreview: { original: clampPreview(originalText), humanized: clampPreview(text) },
    stats: {
      blocks: blocks.length,
      runs: countRuns(blocks),
      charsIn,
      charsOut: text.length,
      geminiCalls: humanized.geminiCalls,
    },
  };
}

/**
 * A document with no rewritable prose — an image-only .docx, say — comes back unchanged
 * with an explanation, rather than as an error or an empty file.
 */
function emptyResult(
  input: ProcessInput,
  outputFormat: DocumentFormat,
  data: string | Buffer,
  warnings: DocumentWarning[],
  format: DocumentFormat,
  metrics: PreservationMetric[]
): DocumentResult {
  const buffer = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  const target = outputFormat === "txt" ? "txt" : format;

  return {
    filename: withExtension(input.filename, target),
    mimeType: MIME_TYPES[target],
    dataBase64: buffer.toString("base64"),
    report: buildReport(format, false, metrics, [
      ...warnings,
      {
        code: "empty-document",
        message:
          "No rewritable text was found — the document may contain only images, code, or fields. It was returned unchanged.",
      },
    ]),
    textPreview: { original: "", humanized: "" },
    stats: { blocks: 0, runs: 0, charsIn: 0, charsOut: 0, geminiCalls: 0 },
  };
}
