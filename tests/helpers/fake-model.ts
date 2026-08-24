import type { RewriteFn } from "@/lib/documents/common/segment-humanizer";

const DELIMITER_SPLIT = /^<<<B(\d+)>>>[ \t]*$/gm;
const MARKER_SPLIT = /(\[\[\d+\]\])/g;

export interface FakeModelOptions {
  /** Applied to each text segment between markers. Defaults to upper-casing. */
  transform?: (segment: string) => string;
  /** Drop every marker from the reply, simulating a model that ignores the protocol. */
  dropMarkers?: boolean;
  /** Omit this many blocks from the reply, simulating a truncated response. */
  omitBlocks?: number;
  /** Throw instead of replying, simulating a Gemini outage. */
  fail?: boolean;
  /** Record every prompt the pipeline sends. */
  calls?: string[];
}

/**
 * A stand-in for `rewriteText` that speaks the batch protocol correctly.
 *
 * Tests run the real pipeline end to end against this, so they exercise the actual
 * extraction, replacement, and validation code rather than a simplified stub of it.
 */
export function fakeModel(options: FakeModelOptions = {}): RewriteFn {
  const transform = options.transform ?? ((s: string) => s.toUpperCase());

  return async (text: string) => {
    options.calls?.push(text);

    if (options.fail) {
      throw new Error("[GoogleGenerativeAI Error] simulated failure");
    }

    const headers: { index: number; start: number; end: number }[] = [];
    DELIMITER_SPLIT.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = DELIMITER_SPLIT.exec(text)) !== null) {
      headers.push({
        index: Number.parseInt(match[1], 10),
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    const blocks = headers.map((header, i) => {
      const stop = i + 1 < headers.length ? headers[i + 1].start : text.length;
      const body = text.slice(header.end, stop).replace(/^\n/, "").replace(/\n$/, "");

      const rewritten = body
        .split(MARKER_SPLIT)
        .map((piece) => (/^\[\[\d+\]\]$/.test(piece) ? (options.dropMarkers ? "" : piece) : transform(piece)))
        .join("");

      return `<<<B${header.index}>>>\n${rewritten}`;
    });

    const kept = options.omitBlocks ? blocks.slice(0, Math.max(0, blocks.length - options.omitBlocks)) : blocks;
    return kept.join("\n");
  };
}

/** Fails the first `n` calls, then behaves normally — for retry-path tests. */
export function flakyModel(n: number, options: FakeModelOptions = {}): RewriteFn {
  const good = fakeModel(options);
  let remaining = n;
  return async (text, prompt) => {
    if (remaining-- > 0) throw new Error("[503 Service Unavailable] simulated overload");
    return good(text, prompt);
  };
}
