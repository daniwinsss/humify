import type { DocumentWarning, PreservationMetric } from "../common/types";
import { elementsByTag, type ParsedDocx } from "./parser";

/** A structural snapshot of a .docx, taken before and after rewriting. */
export interface DocxFingerprint {
  entryNames: string[];
  paragraphs: number;
  runs: number;
  runProperties: number;
  bold: number;
  italic: number;
  underline: number;
  tables: number;
  rows: number;
  cells: number;
  images: number;
  imageRefs: string[];
  headings: number;
  hyperlinks: number;
  numbering: number;
  sections: number;
  pageBreaks: number;
  headers: number;
  footers: number;
  /** Every paragraph and character style referenced, as a multiset. */
  styles: string[];
  textLength: number;
}

/** Count elements across every text-bearing part. */
function countAll(parsed: ParsedDocx, tag: string): number {
  return parsed.parts.reduce((sum, part) => sum + part.root.getElementsByTagName(tag).length, 0);
}

export function fingerprintDocx(parsed: ParsedDocx): DocxFingerprint {
  const styles: string[] = [];
  const imageRefs: string[] = [];
  let textLength = 0;
  let pageBreaks = 0;

  for (const part of parsed.parts) {
    const root = part.root;

    for (const el of elementsByTag(root, "w:pStyle")) {
      const val = el.getAttribute("w:val");
      if (val) styles.push(`p:${val}`);
    }
    for (const el of elementsByTag(root, "w:rStyle")) {
      const val = el.getAttribute("w:val");
      if (val) styles.push(`r:${val}`);
    }
    for (const el of elementsByTag(root, "a:blip")) {
      const id = el.getAttribute("r:embed") ?? el.getAttribute("r:link");
      if (id) imageRefs.push(id);
    }
    for (const el of elementsByTag(root, "w:br")) {
      if (el.getAttribute("w:type") === "page") pageBreaks++;
    }
    for (const el of elementsByTag(root, "w:t")) {
      textLength += (el.textContent ?? "").length;
    }
  }

  return {
    entryNames: [...parsed.entryNames].sort(),
    paragraphs: countAll(parsed, "w:p"),
    runs: countAll(parsed, "w:r"),
    runProperties: countAll(parsed, "w:rPr"),
    bold: countAll(parsed, "w:b"),
    italic: countAll(parsed, "w:i"),
    underline: countAll(parsed, "w:u"),
    tables: countAll(parsed, "w:tbl"),
    rows: countAll(parsed, "w:tr"),
    cells: countAll(parsed, "w:tc"),
    images: countAll(parsed, "w:drawing") + countAll(parsed, "w:pict"),
    imageRefs,
    headings: styles.filter((s) => /^p:(Heading|Title|Subtitle)/i.test(s)).length,
    hyperlinks: countAll(parsed, "w:hyperlink"),
    numbering: countAll(parsed, "w:numPr"),
    sections: countAll(parsed, "w:sectPr"),
    pageBreaks,
    headers: parsed.entryNames.filter((n) => /^word\/header\d+\.xml$/.test(n)).length,
    footers: parsed.entryNames.filter((n) => /^word\/footer\d+\.xml$/.test(n)).length,
    styles,
    textLength,
  };
}

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

export function compareDocx(
  before: DocxFingerprint,
  after: DocxFingerprint
): { metrics: PreservationMetric[]; warnings: DocumentWarning[] } {
  const metrics: PreservationMetric[] = [
    metric("Paragraphs", before.paragraphs, after.paragraphs),
    metric("Headings", before.headings, after.headings),
    metric("Text runs", before.runs, after.runs),
    metric("Run formatting", before.runProperties, after.runProperties),
    metric("Bold / italic / underline", before.bold + before.italic + before.underline, after.bold + after.italic + after.underline),
    metric("Tables", before.tables, after.tables),
    metric("Table rows", before.rows, after.rows),
    metric("Table cells", before.cells, after.cells),
    metric("Images", before.images, after.images),
    metric("Image references", before.imageRefs.length, multisetPreserved(before.imageRefs, after.imageRefs)),
    metric("Hyperlinks", before.hyperlinks, after.hyperlinks),
    metric("Lists", before.numbering, after.numbering),
    metric("Sections", before.sections, after.sections),
    metric("Page breaks", before.pageBreaks, after.pageBreaks),
    metric("Headers", before.headers, after.headers),
    metric("Footers", before.footers, after.footers),
    metric("Styles", before.styles.length, multisetPreserved(before.styles, after.styles)),
    metric("Archive parts", before.entryNames.length, multisetPreserved(before.entryNames, after.entryNames)),
  ];

  const warnings: DocumentWarning[] = [];

  const missingParts = before.entryNames.filter((n) => !after.entryNames.includes(n));
  for (const part of missingParts) {
    warnings.push({
      code: "content-lost",
      message: `The document part "${part}" is missing from the output.`,
      location: part,
    });
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
