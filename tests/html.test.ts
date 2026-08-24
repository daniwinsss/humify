import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { processDocument } from "@/lib/documents/process";
import { fingerprintHtml } from "@/lib/documents/html/validator";
import { parseHtml } from "@/lib/documents/html/parser";
import { sanitizeForPreview } from "@/lib/documents/html/sanitizer";
import { isDocumentError } from "@/lib/documents/common/errors";
import { fakeModel } from "./helpers/fake-model";

const FIXTURES = join(process.cwd(), "tests", "fixtures", "html");

function fixture(name: string): Buffer {
  return readFileSync(join(FIXTURES, name));
}

async function run(name: string, outputFormat?: "html" | "txt") {
  const result = await processDocument({
    filename: name,
    format: "html",
    buffer: fixture(name),
    systemPrompt: "test",
    outputFormat,
    rewrite: fakeModel(),
  });
  return { result, output: Buffer.from(result.dataBase64, "base64").toString("utf8") };
}

describe("HTML — structure preservation", () => {
  it("reports every structural metric as fully preserved", async () => {
    const { result } = await run("rich.html");

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

  it("keeps inline formatting boundaries around the rewritten words", async () => {
    const { output } = await run("rich.html");
    // The bold span still wraps exactly the words it wrapped before.
    assert.match(output, /<strong>VERY IMPORTANT<\/strong>/);
    assert.match(output, /<em>FRIDAY<\/em>/);
  });

  it("preserves deeply nested inline formatting", async () => {
    const { output } = await run("rich.html");
    assert.match(output, /<strong>NESTED <em>FORMATTING <u>LIKE THIS<\/u><\/em><\/strong>/);
  });

  it("preserves headings, lists, tables and blockquotes", async () => {
    const { output } = await run("rich.html");
    for (const tag of ["h1", "h2", "h3", "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td", "blockquote"]) {
      assert.ok(output.includes(`<${tag}`), `missing <${tag}>`);
    }
  });

  it("preserves classes, IDs, inline styles and attributes verbatim", async () => {
    const { output } = await run("rich.html");
    assert.ok(output.includes('id="title"'));
    assert.ok(output.includes('class="page-title"'));
    assert.ok(output.includes('style="margin-bottom: 1rem;"'));
    assert.ok(output.includes('id="regions"'));
    assert.ok(output.includes('width="400"'));
  });

  it("preserves hyperlinks and image sources exactly", async () => {
    const { output } = await run("rich.html");
    assert.ok(output.includes('href="mailto:ops@example.com"'));
    assert.ok(output.includes('href="https://example.com/docs"'));
    assert.ok(output.includes('src="chart.png"'));
    assert.ok(output.includes('alt="Revenue chart"'));
  });
});

describe("HTML — content that must not be rewritten", () => {
  it("leaves <script> contents untouched", async () => {
    const { output } = await run("rich.html");
    assert.ok(output.includes('console.log("this script must never be humanized");'));
  });

  it("leaves <style> contents untouched", async () => {
    const { output } = await run("rich.html");
    assert.ok(output.includes("font-family: Georgia, serif;"));
  });

  it("leaves <pre> and <code> contents untouched", async () => {
    const { output } = await run("rich.html");
    assert.ok(output.includes("npm run report -- --quarter=Q3"));
    assert.ok(output.includes("<code>getRevenue()</code>"));
  });

  it("leaves the document <title> untouched", async () => {
    const { output } = await run("rich.html");
    assert.ok(output.includes("<title>Quarterly Report</title>"));
  });

  it("does not rewrite a bare email address used as link text", async () => {
    const { output } = await run("rich.html");
    assert.ok(output.includes(">ops@example.com<"));
  });
});

describe("HTML — edge cases", () => {
  it("recovers from malformed markup instead of failing", async () => {
    const { result, output } = await run("malformed.html");
    assert.ok(output.length > 0);
    assert.equal(result.report.textModified, true);
    assert.ok(output.includes("</p>"), "parse5 should have repaired the unclosed tags");
  });

  it("returns an image-only document unchanged, with an explanation", async () => {
    const { result, output } = await run("images-only.html");
    assert.equal(result.report.textModified, false);
    assert.ok(output.includes('src="one.png"'));
    assert.ok(output.includes('src="two.png"'));
    assert.ok(result.report.warnings.some((w) => w.code === "empty-document"));
  });

  it("rejects an empty document with a clear error", async () => {
    await assert.rejects(
      () =>
        processDocument({
          filename: "empty.html",
          format: "html",
          buffer: Buffer.from("   ", "utf8"),
          systemPrompt: "test",
          rewrite: fakeModel(),
        }),
      (error: unknown) => isDocumentError(error) && error.code === "empty-document"
    );
  });

  it("does not invent a document shell around a fragment", async () => {
    const result = await processDocument({
      filename: "fragment.html",
      format: "html",
      buffer: Buffer.from("<p>A short pasted paragraph of text.</p>", "utf8"),
      systemPrompt: "test",
      rewrite: fakeModel(),
    });
    const output = Buffer.from(result.dataBase64, "base64").toString("utf8");
    assert.ok(!output.includes("<html"));
    assert.ok(!output.includes("<body"));
    assert.match(output, /^<p>.*<\/p>$/);
  });

  it("produces a plain-text export that admits it dropped formatting", async () => {
    const { result, output } = await run("simple.html", "txt");
    assert.ok(output.includes("THE MEETING WAS PRODUCTIVE"));
    assert.ok(!output.includes("<p>"));
    assert.ok(result.report.warnings.some((w) => w.message.includes("Plain-text output")));
    assert.equal(result.filename, "simple-humanized.txt");
  });
});

describe("HTML — preview sanitization", () => {
  const hostile = `
    <p onclick="steal()">Hello <script>alert(1)</script></p>
    <img src="x" onerror="alert(2)">
    <a href="javascript:alert(3)">click me</a>
    <iframe src="https://evil.example"></iframe>
    <style>body{background:url(javascript:alert(4))}</style>
  `;

  it("strips scripts, event handlers, and unsafe URLs", () => {
    const safe = sanitizeForPreview(hostile);
    assert.ok(!safe.includes("<script"));
    assert.ok(!safe.includes("alert(1)"));
    assert.ok(!safe.includes("onclick"));
    assert.ok(!safe.includes("onerror"));
    assert.ok(!safe.includes("javascript:"));
    assert.ok(!safe.includes("<iframe"));
    assert.ok(!safe.includes("<style"));
  });

  it("keeps the formatting the pipeline promises to preserve", () => {
    const safe = sanitizeForPreview(
      '<h1 id="t" class="c">Title</h1><p style="color: red">a <strong>b</strong> <em>c</em></p><table><tr><td>d</td></tr></table><img src="https://example.com/a.png">'
    );
    assert.ok(safe.includes("<h1"));
    assert.ok(safe.includes('id="t"'));
    assert.ok(safe.includes('class="c"'));
    assert.ok(safe.includes("<strong>b</strong>"));
    assert.ok(safe.includes("<em>c</em>"));
    assert.ok(safe.includes("<td>d</td>"));
    assert.ok(safe.includes("https://example.com/a.png"));
    assert.ok(safe.includes("color:red") || safe.includes("color: red"));
  });

  it("marks preview links as safe to open", () => {
    const safe = sanitizeForPreview('<a href="https://example.com">x</a>');
    assert.ok(safe.includes('rel="noopener noreferrer nofollow"'));
  });

  it("is applied to the preview but not to the downloaded file", async () => {
    const { result, output } = await run("rich.html");
    assert.ok(output.includes("<script>"), "the download must stay faithful");
    assert.ok(result.previewHtml !== undefined);
    assert.ok(!result.previewHtml!.includes("<script"), "the preview must be sanitized");
  });
});

describe("HTML — fingerprinting", () => {
  it("counts a document's structure accurately", () => {
    const fp = fingerprintHtml(parseHtml(fixture("rich.html").toString("utf8")));
    assert.equal(fp.headings, 3);
    assert.equal(fp.tables, 1);
    assert.equal(fp.listItems, 5);
    assert.equal(fp.links.length, 2);
    assert.equal(fp.images.length, 1);
    assert.ok(fp.ids.includes("title"));
    assert.ok(fp.classes.includes("page-title"));
  });
});
