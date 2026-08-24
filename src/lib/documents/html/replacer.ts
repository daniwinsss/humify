import { renderRun } from "../common/document-model";
import type { HtmlExtraction } from "./extractor";

/**
 * Write rewritten text back into the DOM, in place.
 *
 * Only `TextNode.value` is ever assigned. Elements, attributes, and the tree shape are
 * never touched, which is what makes formatting preservation structural rather than
 * best-effort.
 */
export function applyHtmlReplacements(
  extraction: HtmlExtraction,
  replacements: Map<string, string>
): number {
  let modified = 0;

  for (const block of extraction.blocks) {
    for (const run of block.runs) {
      const next = replacements.get(run.id);
      if (next === undefined) continue;

      const node = extraction.nodes.get(run.id);
      if (!node) continue;

      node.value = renderRun(run, next);
      modified++;
    }
  }

  return modified;
}
