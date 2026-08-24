/**
 * Builds real .docx archives in memory for the test suite.
 *
 * These are hand-written OOXML rather than library output so the fixtures exercise the
 * exact structures the spec calls out — run-level formatting, tables, hyperlinks, images,
 * headers/footers, page breaks, and multiple sections — with nothing hidden behind a
 * generator's abstractions.
 */
import JSZip from "jszip";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const PIC = "http://schemas.openxmlformats.org/drawingml/2006/picture";

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

/** A 1×1 transparent PNG — enough to be a real, content-typed binary part. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const CONTENT_TYPES = `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`;

const ROOT_RELS = `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`;

const DOCUMENT_RELS = `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/styles" Target="styles.xml"/><Relationship Id="rId2" Type="${R}/header" Target="header1.xml"/><Relationship Id="rId3" Type="${R}/footer" Target="footer1.xml"/><Relationship Id="rId4" Type="${R}/image" Target="media/image1.png"/><Relationship Id="rId5" Type="${R}/hyperlink" Target="https://example.com/handbook" TargetMode="External"/></Relationships>`;

const STYLES = `${XML_DECL}<w:styles xmlns:w="${W}"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:rPr><w:i/></w:rPr></w:style></w:styles>`;

const HEADER = `${XML_DECL}<w:hdr xmlns:w="${W}"><w:p><w:r><w:t>Internal handbook — confidential draft.</w:t></w:r></w:p></w:hdr>`;

const FOOTER = `${XML_DECL}<w:ftr xmlns:w="${W}"><w:p><w:r><w:t>Prepared by the operations team.</w:t></w:r></w:p></w:ftr>`;

function docXml(body: string): string {
  return `${XML_DECL}<w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="${WP}" xmlns:a="${A}" xmlns:pic="${PIC}"><w:body>${body}</w:body></w:document>`;
}

const DRAWING = `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="914400" cy="914400"/><wp:docPr id="1" name="Picture 1"/><a:graphic><a:graphicData uri="${PIC}"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="image1.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId4"/><a:stretch><a:srcRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"/></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;

const SECT_PR = `<w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>`;

/** Same section, without header/footer references — for the genuinely text-free fixtures. */
const BARE_SECT_PR = `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>`;

/**
 * The full-featured fixture: every structure the spec's DOCX test list names.
 */
const RICH_BODY = [
  // Heading
  `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Introduction</w:t></w:r></w:p>`,

  // Run-level formatting: normal / bold / italic in one paragraph, with explicit fonts,
  // colour, alignment, spacing and indentation on the paragraph.
  `<w:p><w:pPr><w:jc w:val="both"/><w:ind w:left="720" w:firstLine="360"/><w:spacing w:before="120" w:after="240" w:line="360" w:lineRule="auto"/></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="333333"/></w:rPr><w:t xml:space="preserve">This is </w:t></w:r>` +
    `<w:r><w:rPr><w:b/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr><w:t>very important</w:t></w:r>` +
    `<w:r><w:rPr><w:i/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve"> and urgent</w:t></w:r>` +
    `<w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t xml:space="preserve"> information</w:t></w:r>` +
    `<w:r><w:t>.</w:t></w:r></w:p>`,

  // Hyperlink: display text is prose, the target lives in the relationships part.
  `<w:p><w:r><w:t xml:space="preserve">Please read the </w:t></w:r><w:hyperlink r:id="rId5"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t>operations handbook</w:t></w:r></w:hyperlink><w:r><w:t xml:space="preserve"> before starting.</w:t></w:r></w:p>`,

  // Bulleted and numbered list items
  `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Check the equipment before every shift.</w:t></w:r></w:p>`,
  `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr><w:r><w:t>Record any faults in the shared log.</w:t></w:r></w:p>`,

  // Heading 2 + table with formatted cell text
  `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Shift summary</w:t></w:r></w:p>`,
  `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>` +
    `<w:tr><w:tc><w:tcPr><w:tcW w:w="2500" w:type="pct"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Shift</w:t></w:r></w:p></w:tc>` +
    `<w:tc><w:tcPr><w:tcW w:w="2500" w:type="pct"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Notes</w:t></w:r></w:p></w:tc></w:tr>` +
    `<w:tr><w:tc><w:p><w:r><w:t>Morning</w:t></w:r></w:p></w:tc>` +
    `<w:tc><w:p><w:r><w:t>Everything ran smoothly with no reported issues.</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`,

  // Quote style
  `<w:p><w:pPr><w:pStyle w:val="Quote"/></w:pPr><w:r><w:t>Consistency matters more than speed.</w:t></w:r></w:p>`,

  // Image paragraph
  `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${DRAWING}</w:p>`,

  // A field-bearing paragraph (a page reference). Must be left alone.
  `<w:p><w:r><w:t xml:space="preserve">See page </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGEREF _Ref1 \\h </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>4</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`,

  // Explicit page break, then a second section
  `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`,
  `<w:p><w:pPr>${SECT_PR}</w:pPr></w:p>`,
  `<w:p><w:r><w:t>The appendix contains the full incident history for the quarter.</w:t></w:r></w:p>`,
  SECT_PR,
].join("");

const SIMPLE_BODY =
  `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Introduction</w:t></w:r></w:p>` +
  `<w:p><w:r><w:t>This is an important paragraph that explains the purpose of the document.</w:t></w:r></w:p>` +
  SECT_PR;

/**
 * No prose at all — exercises the "document containing only images" path. Built without a
 * header or footer, since those carry text and would make the document non-empty.
 */
const IMAGE_ONLY_BODY = `<w:p>${DRAWING}</w:p>` + BARE_SECT_PR;

const EMPTY_BODY = `<w:p/>` + BARE_SECT_PR;

async function build(body: string, withHeaderFooter = true): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    withHeaderFooter
      ? CONTENT_TYPES
      : CONTENT_TYPES.replace(/<Override PartName="\/word\/(header|footer)1\.xml"[^>]*\/>/g, "")
  );
  zip.file("_rels/.rels", ROOT_RELS);
  zip.file("word/document.xml", docXml(body));
  zip.file(
    "word/_rels/document.xml.rels",
    withHeaderFooter
      ? DOCUMENT_RELS
      : DOCUMENT_RELS.replace(/<Relationship Id="rId[23]"[^>]*\/>/g, "")
  );
  zip.file("word/styles.xml", STYLES);
  if (withHeaderFooter) {
    zip.file("word/header1.xml", HEADER);
    zip.file("word/footer1.xml", FOOTER);
  }
  zip.file("word/media/image1.png", Buffer.from(PNG_BASE64, "base64"));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export const richDocx = () => build(RICH_BODY);
export const simpleDocx = () => build(SIMPLE_BODY);
export const imageOnlyDocx = () => build(IMAGE_ONLY_BODY, false);
export const emptyDocx = () => build(EMPTY_BODY, false);

/** A zip that is not a Word document, for the invalid-input path. */
export async function notADocx(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("hello.txt", "this is not a word document");
  return zip.generateAsync({ type: "nodebuffer" });
}
