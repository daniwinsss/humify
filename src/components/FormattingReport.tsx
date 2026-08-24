"use client";

import { useState } from "react";
import type { PreservationReport } from "@/lib/documents/common/types";

interface FormattingReportProps {
  report: PreservationReport;
  reportText: string;
}

function percentLabel(percent: number | null): string {
  if (percent === null) return "n/a";
  const rounded = Math.round(percent * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

export default function FormattingReport({ report, reportText }: FormattingReportProps) {
  const [copied, setCopied] = useState(false);
  const measured = report.metrics.filter((m) => m.percent !== null);

  async function handleCopy() {
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Formatting Preservation Report
        </h3>
        <button
          onClick={handleCopy}
          className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          {copied ? "Copied!" : "Copy report"}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`rounded-full px-2.5 py-1 font-medium ${
            report.fullyPreserved
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
          }`}
        >
          {report.fullyPreserved
            ? "Formatting fully preserved — verified"
            : measured.length === 0
              ? "Formatting not measurable"
              : "Formatting partially preserved"}
        </span>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          Text modified: {report.textModified ? "yes" : "no"}
        </span>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium uppercase text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {report.format}
        </span>
      </div>

      {report.metrics.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <th className="py-1.5 pr-4 font-medium">Element</th>
                <th className="py-1.5 pr-4 font-medium">Before</th>
                <th className="py-1.5 pr-4 font-medium">After</th>
                <th className="py-1.5 font-medium">Preserved</th>
              </tr>
            </thead>
            <tbody>
              {report.metrics.map((metric) => (
                <tr key={metric.label} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-1.5 pr-4 text-zinc-700 dark:text-zinc-300">{metric.label}</td>
                  <td className="py-1.5 pr-4 tabular-nums text-zinc-500 dark:text-zinc-400">{metric.before}</td>
                  <td className="py-1.5 pr-4 tabular-nums text-zinc-500 dark:text-zinc-400">{metric.after}</td>
                  <td
                    className={`py-1.5 tabular-nums font-medium ${
                      metric.percent === null
                        ? "text-zinc-400 dark:text-zinc-500"
                        : metric.percent === 100
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {percentLabel(metric.percent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {report.warnings.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Notes &amp; warnings
          </h4>
          <ul className="flex flex-col gap-1">
            {report.warnings.map((warning, i) => (
              <li key={`${warning.code}-${i}`} className="text-xs text-zinc-600 dark:text-zinc-400">
                • {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
