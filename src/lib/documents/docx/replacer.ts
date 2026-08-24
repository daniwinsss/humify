import { renderRun } from "../common/document-model";
import type { DocxExtraction } from "./extractor";

/**
 * Write rewritten text into the `<w:t>` elements, in place.
 *
 * Nothing else in the XML is touched: run properties (`<w:rPr>`), paragraph properties,
 * tables, drawings, and section properties all keep their original nodes. That is why bold
 * runs stay bold and images stay put — we never rebuild the document, we edit it.
 */
export function applyDocxReplacements(
  extraction: DocxExtraction,
  replacements: Map<string, string>
): number {
  let modified = 0;

  for (const block of extraction.blocks) {
    for (const run of block.runs) {
      const next = replacements.get(run.id);
      if (next === undefined) continue;

      const element = extraction.nodes.get(run.id);
      if (!element) continue;

      const value = renderRun(run, next);
      element.textContent = value;

      // Without xml:space="preserve" Word silently strips edge whitespace, which would
      // glue adjacent runs together ("This isvery important").
      if (value !== value.trim()) {
        element.setAttribute("xml:space", "preserve");
      }

      modified++;
    }
  }

  return modified;
}
