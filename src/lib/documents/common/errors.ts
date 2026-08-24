export type DocumentErrorCode =
  | "unsupported-format"
  | "file-too-large"
  | "empty-file"
  | "empty-document"
  | "malformed-html"
  | "invalid-docx"
  | "no-text-content"
  | "processing-failed";

/**
 * An error we can explain to the user, carrying the HTTP status the API should return.
 */
export class DocumentError extends Error {
  readonly code: DocumentErrorCode;
  readonly status: number;

  constructor(code: DocumentErrorCode, message: string, status = 400) {
    super(message);
    this.name = "DocumentError";
    this.code = code;
    this.status = status;
  }
}

export function isDocumentError(error: unknown): error is DocumentError {
  return error instanceof DocumentError;
}
