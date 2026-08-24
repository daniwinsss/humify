import type { DocumentFormat } from "./types";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Largest upload we accept, before decoding. */
export const MAX_FILE_BYTES = envInt("DOCUMENT_MAX_FILE_BYTES", 10 * 1024 * 1024);

/** Largest total amount of text we will send to Gemini for one document. */
export const MAX_TEXT_CHARS = envInt("DOCUMENT_MAX_TEXT_CHARS", 400_000);

/** Target size of one batched Gemini request. Blocks are packed up to this budget. */
export const BATCH_CHAR_BUDGET = envInt("DOCUMENT_BATCH_CHARS", 6_000);

/** How many batches may be in flight at once. Kept low for free-tier rate limits. */
export const BATCH_CONCURRENCY = envInt("DOCUMENT_BATCH_CONCURRENCY", 2);

export const EXTENSION_FORMATS: Record<string, DocumentFormat> = {
  ".html": "html",
  ".htm": "html",
  ".docx": "docx",
  ".txt": "txt",
};

export const MIME_TYPES: Record<DocumentFormat, string> = {
  html: "text/html; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain; charset=utf-8",
};

export function formatFromFilename(filename: string): DocumentFormat | null {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return null;
  return EXTENSION_FORMATS[filename.slice(dot).toLowerCase()] ?? null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
