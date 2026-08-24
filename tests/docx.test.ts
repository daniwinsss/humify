import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import { processDocument } from "@/lib/documents/process";
import { parseDocx } from "@/lib/documents/docx/parser";
import { extractDocx } from "@/lib/documents/docx/extractor";
import { fingerprintDocx } from "@/lib/documents/docx/validator";
import { isDocumentError } from "@/lib/documents/common/errors";
import { fakeModel } from "./helpers/fake-model";
import { emptyDocx, imageOnlyDocx, notADocx, richDocx, simpleDocx } from "./fixtures/docx-fixtures";

async function run(buffer: Buffer, outputFormat?: "docx" | "txt") {
  const result = await processDocument({
    filename: "fixture.docx",
    format: "docx",
    buffer,
    systemPrompt: "test",
    outputFormat,
    rewrite: fakeModel(),
  });
  return { result, output: Buffer.from(result.dataBase64, "base64") };
}

async function readPart(buffer: Buffer, path: string): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file(path);
  assert.ok(file, `missing part ${path}`);
  return file.async("string");
}

describe("DOCX — structure preservation", () => {
  it("reports every structural metric as fully preserved", async () => {
    const { result } = await run(await richDocx());

    for (const metric of result.report.metrics) {
      assert.equal(
        metric.percent === null ? 100 : metric.percent,
        100,
        `${metric.label}: ${metric.after}/${metric.before}`
      );
    }
    assert.equal(result.report.fullyPreserved, true);
    assert.equal(result.report.textModified, true);
  });

  it("keeps every archive part, including the embedded image bytes", async () => {
    const source = await richDocx();
    const { output } = await run(source);

    const before = await JSZip.loadAsync(source);
    const after = await JSZip.loadAsync(output);

    assert.deepEqual(Object.keys(after.files).sort(), Object.keys(before.files).sort());

    const imageBefore = await before.file("word/media/image1.png")!.async("nodebuffer");
    const imageAfter = await after.file("word/media/image1.png")!.async("nodebuffer");
    assert.ok(imageBefore.equals(imageAfter), "the image bytes must be byte-identical");
  });

  it("leaves relationships, styles and content types byte-identical", async () => {
    const source = await richDocx();
    const { output } = await run(source);

    for (const part of ["word/_rels/document.xml.rels", "word/styles.xml", "[Content_Types].xml", "_rels/.rels"]) {
      assert.equal(await readPart(output, part), await readPart(source, part), `${part} changed`);
    }
  });

  it("preserves run-level formatting around the rewritten words", async () => {
    const { output } = await run(await richDocx());
    const xml = await readPart(output, "word/document.xml");

    // The bold run still exists, still carries <w:b/>, and now holds the rewritten text.
    assert.match(xml, /<w:rPr><w:b\/>[\s\S]*?<\/w:rPr><w:t>VERY IMPORTANT<\/w:t>/);
    assert.match(xml, /<w:i\/>[\s\S]*?<w:t xml:space="preserve"> AND URGENT<\/w:t>/);
    assert.match(xml, /<w:u w:val="single"\/><\/w:rPr><w:t xml:space="preserve"> INFORMATION<\/w:t>/);
  });

  it("does not flatten a multi-run paragraph into one run", async () => {
    const source = await richDocx();
    const { output } = await run(source);

    const before = fingerprintDocx(await parseDocx(source));
    const after = fingerprintDocx(await parseDocx(output));

    assert.equal(after.runs, before.runs);
    assert.equal(after.runProperties, before.runProperties);
    assert.equal(after.bold, before.bold);
    assert.equal(after.italic, before.italic);
    assert.equal(after.underline, before.underline);
  });

  it("preserves paragraph formatting: alignment, indentation and spacing", async () => {
    const { output } = await run(await richDocx());
    const xml = await readPart(output, "word/document.xml");

    assert.ok(xml.includes('<w:jc w:val="both"/>'));
    assert.ok(xml.includes('<w:ind w:left="720" w:firstLine="360"/>'));
    assert.ok(xml.includes('<w:spacing w:before="120" w:after="240" w:line="360" w:lineRule="auto"/>'));
    assert.ok(xml.includes('<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>'));
    assert.ok(xml.includes('<w:color w:val="333333"/>'));
    assert.ok(xml.includes('<w:sz w:val="22"/>'));
  });

  it("preserves headings, lists, tables, sections and page breaks", async () => {
    const { output } = await run(await richDocx());
    const xml = await readPart(output, "word/document.xml");

    assert.ok(xml.includes('<w:pStyle w:val="Heading1"/>'));
    assert.ok(xml.includes('<w:pStyle w:val="Heading2"/>'));
    assert.ok(xml.includes('<w:numPr>'));
    assert.ok(xml.includes("<w:tbl>"));
    assert.ok(xml.includes('<w:tblStyle w:val="TableGrid"/>'));
    assert.ok(xml.includes('<w:br w:type="page"/>'));
    assert.ok(xml.includes("<w:sectPr>"));
  });

  it("preserves hyperlinks and their targets", async () => {
    const { output } = await run(await richDocx());
    const xml = await readPart(output, "word/document.xml");
    const rels = await readPart(output, "word/_rels/document.xml.rels");

    assert.ok(xml.includes('<w:hyperlink r:id="rId5">'));
    assert.ok(rels.includes("https://example.com/handbook"));
    // The visible link text is prose and should have been rewritten.
    assert.ok(xml.includes("OPERATIONS HANDBOOK"));
  });

  it("preserves the image drawing and its relationship id", async () => {
    const { output } = await run(await richDocx());
    const xml = await readPart(output, "word/document.xml");

    assert.ok(xml.includes("<w:drawing>"));
    assert.ok(xml.includes('<a:blip r:embed="rId4"/>'));
    assert.ok(xml.includes('<wp:extent cx="914400" cy="914400"/>'));
  });

  it("rewrites header and footer text too", async () => {
    const { output } = await run(await richDocx());

    assert.ok((await readPart(output, "word/header1.xml")).includes("INTERNAL HANDBOOK"));
    assert.ok((await readPart(output, "word/footer1.xml")).includes("PREPARED BY THE OPERATIONS TEAM."));
  });

  it("rewrites table cell text without disturbing the table", async () => {
    const { output } = await run(await richDocx());
    const xml = await readPart(output, "word/document.xml");

    assert.ok(xml.includes("EVERYTHING RAN SMOOTHLY WITH NO REPORTED ISSUES."));
    assert.ok(xml.includes('<w:tcW w:w="2500" w:type="pct"/>'));
  });
});

describe("DOCX — content that must not be rewritten", () => {
  it("leaves a paragraph containing a Word field untouched", async () => {
    const { result, output } = await run(await richDocx());
    const xml = await readPart(output, "word/document.xml");

    assert.ok(xml.includes('<w:t xml:space="preserve">See page </w:t>'), "field paragraph text changed");
    assert.ok(xml.includes("PAGEREF _Ref1"), "the field instruction must survive");
    assert.ok(result.report.warnings.some((w) => w.message.includes("Word field")));
  });

  it("keeps xml:space=\"preserve\" so runs don't fuse together", async () => {
    const { output } = await run(await richDocx());
    const xml = await readPart(output, "word/document.xml");

    assert.ok(xml.includes('<w:t xml:space="preserve">THIS IS </w:t>'));
    assert.ok(!xml.includes("THIS ISVERY IMPORTANT"));
  });
});

describe("DOCX — extraction", () => {
  it("groups runs into one block per paragraph", async () => {
    const extraction = extractDocx(await parseDocx(await richDocx()));

    const multiRun = extraction.blocks.find((b) => b.runs.length === 5);
    assert.ok(multiRun, "the run-level formatting paragraph should yield five runs");
    assert.deepEqual(
      multiRun.runs.map((r) => r.core),
      ["This is", "very important", "and urgent", "information", "."]
    );
  });

  it("classifies headings, list items and table cells", async () => {
    const extraction = extractDocx(await parseDocx(await richDocx()));
    const kinds = new Set(extraction.blocks.map((b) => b.kind));

    assert.ok(kinds.has("heading"));
    assert.ok(kinds.has("list-item"));
    assert.ok(kinds.has("table-cell"));
    assert.ok(kinds.has("quote"));
    assert.ok(kinds.has("paragraph"));
  });
});

describe("DOCX — edge cases", () => {
  it("rejects a zip that is not a Word document", async () => {
    const buffer = await notADocx();
    await assert.rejects(
      () =>
        processDocument({
          filename: "fake.docx",
          format: "docx",
          buffer,
          systemPrompt: "test",
          rewrite: fakeModel(),
        }),
      (error: unknown) => isDocumentError(error) && error.code === "invalid-docx"
    );
  });

  it("rejects a file that is not a zip at all", async () => {
    await assert.rejects(
      () =>
        processDocument({
          filename: "fake.docx",
          format: "docx",
          buffer: Buffer.from("this is plain text, not a docx"),
          systemPrompt: "test",
          rewrite: fakeModel(),
        }),
      (error: unknown) => isDocumentError(error) && error.code === "invalid-docx"
    );
  });

  it("returns an image-only document unchanged, with an explanation", async () => {
    const { result, output } = await run(await imageOnlyDocx());

    assert.equal(result.report.textModified, false);
    assert.ok(result.report.warnings.some((w) => w.code === "empty-document"));

    const xml = await readPart(output, "word/document.xml");
    assert.ok(xml.includes("<w:drawing>"), "the image must still be there");
  });

  it("handles a document with no text at all", async () => {
    const { result } = await run(await emptyDocx());
    assert.equal(result.report.textModified, false);
    assert.ok(result.report.warnings.some((w) => w.code === "empty-document"));
  });

  it("exports to plain text on request", async () => {
    const { result, output } = await run(await simpleDocx(), "txt");
    const text = output.toString("utf8");

    assert.ok(text.includes("INTRODUCTION"));
    assert.ok(!text.includes("<w:"));
    assert.equal(result.filename, "fixture-humanized.txt");
    assert.ok(result.report.warnings.some((w) => w.message.includes("Plain-text output")));
  });

  it("produces a file Word can still open, verified by re-parsing it", async () => {
    const { output } = await run(await richDocx());
    const reparsed = await parseDocx(output);

    assert.ok(reparsed.parts.length >= 3, "document, header and footer should all re-parse");
    assert.ok(reparsed.entryNames.includes("word/media/image1.png"));
  });
});
