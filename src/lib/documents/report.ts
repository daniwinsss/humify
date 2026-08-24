import type {
  DocumentFormat,
  DocumentWarning,
  PreservationMetric,
  PreservationReport,
} from "./common/types";

/** Collapse duplicate warnings so a repeated issue is reported once, with a count. */
function dedupeWarnings(warnings: DocumentWarning[]): DocumentWarning[] {
  const seen = new Map<string, { warning: DocumentWarning; count: number }>();

  for (const warning of warnings) {
    const key = `${warning.code}|${warning.message}`;
    const existing = seen.get(key);
    if (existing) existing.count++;
    else seen.set(key, { warning, count: 1 });
  }

  return [...seen.values()].map(({ warning, count }) =>
    count === 1 ? warning : { ...warning, message: `${warning.message} (×${count})` }
  );
}

export function buildReport(
  format: DocumentFormat,
  textModified: boolean,
  metrics: PreservationMetric[],
  warnings: DocumentWarning[]
): PreservationReport {
  const deduped = dedupeWarnings(warnings);

  // "Fully preserved" is a claim we only make when every measured metric actually says so
  // and nothing reported lost content. Metrics with nothing to measure don't count as
  // evidence either way.
  const measured = metrics.filter((m) => m.percent !== null);
  const fullyPreserved =
    measured.length > 0 &&
    measured.every((m) => m.percent === 100) &&
    !deduped.some((w) => w.code === "content-lost");

  return { format, textModified, metrics, warnings: deduped, fullyPreserved };
}

function pct(metric: PreservationMetric): string {
  if (metric.percent === null) return "n/a";
  const rounded = Math.round(metric.percent * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

/** The plain-text report from spec §9, for logs and for copying out of the UI. */
export function formatReportText(report: PreservationReport): string {
  const lines = ["Formatting Preservation Report", ""];

  const width = Math.max(
    "Text modified".length,
    ...report.metrics.map((m) => `${m.label} preserved`.length)
  );

  lines.push(`${"Text modified".padEnd(width + 2)}${report.textModified ? "YES" : "NO"}`);

  for (const metric of report.metrics) {
    const label = `${metric.label} preserved`.padEnd(width + 2);
    const detail = metric.percent === null ? "n/a (none in source)" : `${pct(metric)} (${metric.after}/${metric.before})`;
    lines.push(`${label}${detail}`);
  }

  if (report.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warning of report.warnings) {
      lines.push(`  - ${warning.message}`);
    }
  }

  return lines.join("\n");
}
