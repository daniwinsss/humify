import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildReport, formatReportText } from "@/lib/documents/report";
import type { PreservationMetric } from "@/lib/documents/common/types";

const metric = (label: string, before: number, after: number): PreservationMetric => ({
  label,
  before,
  after,
  percent: before === 0 ? null : Math.min(100, (after / before) * 100),
});

describe("preservation report", () => {
  it("claims full preservation only when every measured metric says so", () => {
    const report = buildReport("html", true, [metric("Links", 4, 4), metric("Images", 2, 2)], []);
    assert.equal(report.fullyPreserved, true);
  });

  it("refuses to claim full preservation when a metric falls short", () => {
    const report = buildReport("html", true, [metric("Links", 4, 3)], []);
    assert.equal(report.fullyPreserved, false);
  });

  it("refuses to claim full preservation when content was reported lost", () => {
    const report = buildReport("docx", true, [metric("Tables", 1, 1)], [
      { code: "content-lost", message: "An image is missing." },
    ]);
    assert.equal(report.fullyPreserved, false);
  });

  it("does not treat 'nothing to measure' as evidence of preservation", () => {
    const report = buildReport("html", true, [metric("Images", 0, 0)], []);
    assert.equal(report.fullyPreserved, false, "a document with no images proves nothing");
    assert.equal(report.metrics[0].percent, null);
  });

  it("renders unmeasurable metrics as n/a rather than 100%", () => {
    const text = formatReportText(buildReport("html", true, [metric("Images", 0, 0)], []));
    assert.match(text, /Images preserved\s+n\/a/);
    assert.ok(!text.includes("Images preserved     100%"));
  });

  it("shows the underlying counts next to each percentage", () => {
    const text = formatReportText(buildReport("docx", true, [metric("Tables", 4, 3)], []));
    assert.match(text, /Tables preserved\s+75% \(3\/4\)/);
  });

  it("states whether the text was actually modified", () => {
    assert.match(formatReportText(buildReport("html", true, [], [])), /Text modified\s+YES/);
    assert.match(formatReportText(buildReport("html", false, [], [])), /Text modified\s+NO/);
  });

  it("collapses repeated warnings into one line with a count", () => {
    const report = buildReport("docx", true, [], [
      { code: "marker-mismatch", message: "A paragraph was kept as-is." },
      { code: "marker-mismatch", message: "A paragraph was kept as-is." },
      { code: "marker-mismatch", message: "A paragraph was kept as-is." },
    ]);

    assert.equal(report.warnings.length, 1);
    assert.match(report.warnings[0].message, /×3/);
  });

  it("lists warnings in the rendered report", () => {
    const text = formatReportText(
      buildReport("html", true, [metric("Links", 2, 2)], [{ code: "api-failure", message: "Gemini timed out." }])
    );
    assert.match(text, /Warnings:/);
    assert.match(text, /Gemini timed out\./);
  });
});
