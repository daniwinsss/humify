import type { DocumentWarning, PreservationMetric } from "../common/types";
import { getAttribute, isElement, isTextNode, walk, type ParsedHtml } from "./parser";

/** A structural snapshot of a document, taken before and after rewriting. */
export interface HtmlFingerprint {
  tagCounts: Record<string, number>;
  totalElements: number;
  links: string[];
  images: string[];
  ids: string[];
  classes: string[];
  inlineStyles: string[];
  attributeCount: number;
  headings: number;
  tables: number;
  listItems: number;
  textLength: number;
}

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

export function fingerprintHtml(parsed: ParsedHtml): HtmlFingerprint {
  const fp: HtmlFingerprint = {
    tagCounts: {},
    totalElements: 0,
    links: [],
    images: [],
    ids: [],
    classes: [],
    inlineStyles: [],
    attributeCount: 0,
    headings: 0,
    tables: 0,
    listItems: 0,
    textLength: 0,
  };

  for (const node of walk(parsed.root)) {
    if (isTextNode(node)) {
      fp.textLength += node.value.length;
      continue;
    }
    if (!isElement(node)) continue;

    const tag = node.tagName.toLowerCase();
    fp.tagCounts[tag] = (fp.tagCounts[tag] ?? 0) + 1;
    fp.totalElements++;
    fp.attributeCount += node.attrs.length;

    if (HEADINGS.has(tag)) fp.headings++;
    if (tag === "table") fp.tables++;
    if (tag === "li") fp.listItems++;
    if (tag === "a") {
      const href = getAttribute(node, "href");
      if (href !== null) fp.links.push(href);
    }
    if (tag === "img" || tag === "source") {
      const src = getAttribute(node, "src") ?? getAttribute(node, "srcset");
      if (src !== null) fp.images.push(src);
    }

    const id = getAttribute(node, "id");
    if (id !== null) fp.ids.push(id);

    const className = getAttribute(node, "class");
    if (className !== null) {
      for (const c of className.split(/\s+/).filter(Boolean)) fp.classes.push(c);
    }

    const style = getAttribute(node, "style");
    if (style !== null) fp.inlineStyles.push(style);
  }

  return fp;
}

/** How many of `before`'s entries survive in `after`, counting duplicates properly. */
function multisetPreserved(before: string[], after: string[]): number {
  const pool = new Map<string, number>();
  for (const value of after) pool.set(value, (pool.get(value) ?? 0) + 1);

  let kept = 0;
  for (const value of before) {
    const remaining = pool.get(value) ?? 0;
    if (remaining > 0) {
      pool.set(value, remaining - 1);
      kept++;
    }
  }
  return kept;
}

function metric(label: string, before: number, after: number): PreservationMetric {
  return {
    label,
    before,
    after,
    percent: before === 0 ? null : Math.min(100, (after / before) * 100),
  };
}

/**
 * Compare two fingerprints into report lines.
 *
 * Percentages come from real counted values on both sides — nothing here reports 100%
 * unless the counts genuinely match.
 */
export function compareHtml(
  before: HtmlFingerprint,
  after: HtmlFingerprint
): { metrics: PreservationMetric[]; warnings: DocumentWarning[] } {
  const metrics: PreservationMetric[] = [
    metric("Elements", before.totalElements, after.totalElements),
    metric("Headings", before.headings, after.headings),
    metric("Tables", before.tables, after.tables),
    metric("List items", before.listItems, after.listItems),
    metric("Images", before.images.length, multisetPreserved(before.images, after.images)),
    metric("Links", before.links.length, multisetPreserved(before.links, after.links)),
    metric("IDs", before.ids.length, multisetPreserved(before.ids, after.ids)),
    metric("Classes", before.classes.length, multisetPreserved(before.classes, after.classes)),
    metric(
      "Inline styles",
      before.inlineStyles.length,
      multisetPreserved(before.inlineStyles, after.inlineStyles)
    ),
    metric("Attributes", before.attributeCount, after.attributeCount),
  ];

  const warnings: DocumentWarning[] = [];

  // Tag-level check catches anything the summary metrics above would miss.
  for (const [tag, count] of Object.entries(before.tagCounts)) {
    const now = after.tagCounts[tag] ?? 0;
    if (now < count) {
      warnings.push({
        code: "content-lost",
        message: `${count - now} <${tag}> element(s) did not survive processing.`,
        location: tag,
      });
    }
  }

  for (const m of metrics) {
    if (m.percent !== null && m.percent < 100) {
      warnings.push({
        code: "content-lost",
        message: `${m.label}: ${m.after} of ${m.before} preserved.`,
        location: m.label,
      });
    }
  }

  return { metrics, warnings };
}
