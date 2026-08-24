import type { Style, Language } from "@/types";

export type DocumentFormat = "html" | "docx" | "txt";

/**
 * A contiguous piece of text that carries a single set of formatting properties.
 *
 * In HTML a run is one DOM text node; in DOCX it is one `<w:t>` element. Runs are the
 * finest granularity at which we can rewrite text without disturbing formatting, which is
 * why the whole pipeline is built around them.
 */
export interface TextRun {
  /** Unique within a document. Used to map rewritten text back to its source node. */
  id: string;
  /** The run's text with leading/trailing whitespace stripped. */
  core: string;
  /** Whitespace that preceded `core`. Re-attached verbatim after rewriting. */
  lead: string;
  /** Whitespace that followed `core`. Re-attached verbatim after rewriting. */
  trail: string;
}

export type BlockKind =
  | "paragraph"
  | "heading"
  | "list-item"
  | "table-cell"
  | "quote"
  | "other";

/**
 * One semantic unit of prose, made of one or more runs.
 *
 * Blocks are the unit we send to Gemini: a whole paragraph gives the model enough context
 * to rewrite well, while the run markers inside it let us put the formatting back.
 */
export interface TextBlock {
  id: string;
  kind: BlockKind;
  runs: TextRun[];
}

export type WarningCode =
  | "marker-mismatch"
  | "block-skipped"
  | "api-failure"
  | "unsupported-element"
  | "empty-document"
  | "content-lost"
  | "truncated";

/**
 * Something that could not be preserved or processed. Surfaced to the user rather than
 * swallowed — the spec is explicit that content must never be discarded silently.
 */
export interface DocumentWarning {
  code: WarningCode;
  message: string;
  /** Block or element this concerns, when known. */
  location?: string;
}

/** One line of the formatting preservation report. */
export interface PreservationMetric {
  label: string;
  before: number;
  after: number;
  /** 0–100, or null when `before` is 0 and the ratio is undefined. */
  percent: number | null;
}

export interface PreservationReport {
  format: DocumentFormat;
  textModified: boolean;
  metrics: PreservationMetric[];
  warnings: DocumentWarning[];
  /** True only when every metric is a verified 100%. Never assumed. */
  fullyPreserved: boolean;
}

export interface DocumentJobOptions {
  style: Style;
  language: Language;
  profileId?: number;
  /** Requested output format. Defaults to the input format. */
  outputFormat?: DocumentFormat;
}

export interface DocumentResult {
  filename: string;
  mimeType: string;
  /** The produced document, base64-encoded for JSON transport. */
  dataBase64: string;
  report: PreservationReport;
  /** Sanitized HTML previews. HTML documents only — never the raw output. */
  previewHtml?: string;
  originalPreviewHtml?: string;
  /**
   * Plain-text before/after of the document's prose. Available for every format, so a
   * .docx (which we cannot render in the browser) still gets a meaningful comparison.
   */
  textPreview: { original: string; humanized: string };
  stats: {
    blocks: number;
    runs: number;
    charsIn: number;
    charsOut: number;
    geminiCalls: number;
  };
}
