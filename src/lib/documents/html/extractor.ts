import { createIdFactory, makeRun } from "../common/document-model";
import type { BlockKind, TextBlock, TextRun } from "../common/types";
import {
  childNodes,
  contentRoot,
  isElement,
  isTextNode,
  type HtmlNode,
  type HtmlTextNode,
  type ParsedHtml,
} from "./parser";

/**
 * Elements whose text content is never prose. We skip the entire subtree — this is the
 * spec's hard requirement that code, styles, and scripts pass through untouched.
 */
export const SKIP_SUBTREE = new Set([
  "script",
  "style",
  "code",
  "pre",
  "textarea",
  "noscript",
  "svg",
  "math",
  "template",
  "head",
  "title",
  "iframe",
  "object",
  "canvas",
]);

/** Elements that start a new prose block. Everything else is treated as inline. */
const BLOCK_KINDS: Record<string, BlockKind> = {
  p: "paragraph",
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  h5: "heading",
  h6: "heading",
  li: "list-item",
  dt: "list-item",
  dd: "list-item",
  td: "table-cell",
  th: "table-cell",
  caption: "table-cell",
  blockquote: "quote",
  figcaption: "other",
  div: "other",
  section: "other",
  article: "other",
  aside: "other",
  header: "other",
  footer: "other",
  main: "other",
  nav: "other",
  address: "other",
  summary: "other",
  details: "other",
  hgroup: "other",
  fieldset: "other",
  legend: "other",
  label: "other",
  form: "other",
  dl: "other",
  ul: "other",
  ol: "other",
  table: "other",
  thead: "other",
  tbody: "other",
  tfoot: "other",
  tr: "other",
  figure: "other",
  body: "other",
};

export interface HtmlExtraction {
  blocks: TextBlock[];
  /** Run id → the DOM text node it came from, for writing results back in place. */
  nodes: Map<string, HtmlTextNode>;
  /** Tags encountered whose contents were deliberately left alone. */
  skippedTags: string[];
}

/**
 * Collect the document's prose into blocks, one per block-level element.
 *
 * Inline elements (`<strong>`, `<em>`, `<a>`…) do not break a block — their text joins the
 * surrounding sentence as separate runs, so the model sees a whole paragraph while we keep
 * every tag boundary.
 */
export function extractHtml(parsed: ParsedHtml): HtmlExtraction {
  const nextBlockId = createIdFactory("hb");
  const nextRunId = createIdFactory("hr");
  const blocks: TextBlock[] = [];
  const nodes = new Map<string, HtmlTextNode>();
  const skippedTags = new Set<string>();

  let currentRuns: TextRun[] = [];
  let currentKind: BlockKind = "paragraph";

  function flush() {
    if (currentRuns.some((r) => r.core.length > 0)) {
      blocks.push({ id: nextBlockId(), kind: currentKind, runs: currentRuns });
    } else {
      // Drop the ids of a block we're discarding so they can't be written back.
      for (const run of currentRuns) nodes.delete(run.id);
    }
    currentRuns = [];
  }

  function visit(node: HtmlNode) {
    for (const child of childNodes(node)) {
      if (isTextNode(child)) {
        const id = nextRunId();
        currentRuns.push(makeRun(id, child.value));
        nodes.set(id, child);
        continue;
      }

      if (!isElement(child)) continue;

      const tag = child.tagName.toLowerCase();

      if (SKIP_SUBTREE.has(tag)) {
        skippedTags.add(tag);
        continue;
      }

      const kind = BLOCK_KINDS[tag];
      if (kind !== undefined) {
        const outerKind = currentKind;
        flush();
        currentKind = kind;
        visit(child);
        flush();
        currentKind = outerKind;
      } else {
        // Inline element — its text belongs to the block already in progress.
        visit(child);
      }
    }
  }

  visit(contentRoot(parsed));
  flush();

  return { blocks, nodes, skippedTags: [...skippedTags] };
}
