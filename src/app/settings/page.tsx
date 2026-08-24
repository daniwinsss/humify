"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import ApiKeyManager from "@/components/ApiKeyManager";
import Link from "next/link";
import type { MetricsSummary } from "@/lib/db";

export default function SettingsPage() {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);

  useEffect(() => {
    fetch("/api/metrics")
      .then((r) => r.json())
      .then(setMetrics)
      .catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-zinc-950">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/app"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
          </Link>
          <h1 className="font-display text-xl font-normal text-zinc-900 dark:text-zinc-50">
            Settings
          </h1>
        </div>

        <div className="space-y-6">
          {/* Monitoring Dashboard */}
          {metrics && (
            <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Monitoring
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Total Requests" value={metrics.totalRequests} />
                <StatCard label="Total Rewrites" value={metrics.totalRewrites} />
                <StatCard label="Avg Latency" value={`${metrics.avgRewriteDurationMs}ms`} />
                <StatCard label="Error Rate" value={`${metrics.errorRate}%`} alert={metrics.errorRate > 5} />
              </div>

              {metrics.styleBreakdown.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Style usage</p>
                  <div className="flex flex-wrap gap-2">
                    {metrics.styleBreakdown.map((s) => (
                      <span key={s.style} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {s.style}: {s.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {metrics.languageBreakdown.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Language usage</p>
                  <div className="flex flex-wrap gap-2">
                    {metrics.languageBreakdown.map((l) => (
                      <span key={l.language} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {l.language}: {l.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {metrics.recentErrors.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-red-500 dark:text-red-400">Recent errors</p>
                  <div className="space-y-1">
                    {metrics.recentErrors.map((e, i) => (
                      <div key={i} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
                        <span className="font-medium">{e.endpoint}</span> — {e.error || "Unknown error"} <span className="text-red-400 dark:text-red-500">({e.created_at})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* API Keys */}
          <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <ApiKeyManager />
          </section>

          {/* API Docs */}
          <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              API Usage
            </h3>
            <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <p>Endpoint: <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">POST /api/v1/rewrite</code></p>
              <p>Auth: <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">Authorization: Bearer &lt;your-key&gt;</code></p>
              <div className="overflow-x-auto rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                <pre className="text-xs">{`curl -X POST /api/v1/rewrite \\
  -H "Authorization: Bearer hum_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Your text here",
    "style": "professional",
    "language": "en"
  }'`}</pre>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Styles: professional, casual, academic, friendly.
                Languages: auto, en, es, fr, de, pt, it, nl, ru, zh, ja, ko, ar, hi, tr.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${
        alert ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-zinc-50"
      }`}>
        {value}
      </p>
    </div>
  );
}
