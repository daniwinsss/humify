"use client";

import type { AILikelihoodSummary, RefinePass } from "@/types";
import InfoTooltip from "./InfoTooltip";
import {
  aiLikelihoodBarColor as barColor,
  aiLikelihoodTextColor as textColor,
  AI_LIKELIHOOD_DISCLAIMER,
} from "./scale";

export { AI_LIKELIHOOD_DISCLAIMER };

interface AILikelihoodComparisonProps {
  summary: AILikelihoodSummary | null;
  /** Per-pass ledger. Omitted by callers that only ran a single pass. */
  passes?: RefinePass[];
}

function ScoreColumn({
  caption,
  score,
  label,
}: {
  caption: string;
  score: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        {caption}
      </span>
      <span className={`font-display text-4xl tabular-nums ${textColor(score)}`}>
        {score}%
      </span>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        {label} AI-likelihood
      </span>
    </div>
  );
}

function TrackRow({ caption, score }: { caption: string; score: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
        {caption}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor(score)}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-zinc-600 dark:text-zinc-300">
        {score}%
      </span>
    </div>
  );
}

/** Direction wording, driven by the interpretation the evaluator assigned. */
function changeText(summary: AILikelihoodSummary): string {
  const points = Math.abs(summary.difference);
  const unit = points === 1 ? "percentage point" : "percentage points";

  switch (summary.interpretation) {
    case "significant_reduction":
      return `Reduced by ${points} ${unit}`;
    case "increase":
      return `Increased by ${points} ${unit}`;
    default:
      return points === 0
        ? "No change detected"
        : `No significant change detected (${points} ${unit})`;
  }
}

function changeStyles(summary: AILikelihoodSummary): { arrow: string; className: string } {
  switch (summary.interpretation) {
    case "significant_reduction":
      return {
        arrow: "↓",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
      };
    case "increase":
      return {
        arrow: "↑",
        className:
          "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300",
      };
    default:
      return {
        arrow: "→",
        className:
          "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300",
      };
  }
}

/**
 * Before/after AI-likelihood estimate.
 *
 * Renders nothing when there is no summary — including for history entries saved
 * before this feature existed, whose stored scores are null.
 */
export default function AILikelihoodComparison({
  summary,
  passes = [],
}: AILikelihoodComparisonProps) {
  if (!summary) return null;

  const change = changeStyles(summary);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-lg font-normal text-zinc-900 dark:text-zinc-50">
          AI-Likelihood Estimate
        </h2>
        <InfoTooltip text={AI_LIKELIHOOD_DISCLAIMER} label="About the AI-likelihood estimate" />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex items-center justify-center gap-6 sm:gap-10">
          <ScoreColumn
            caption="Before"
            score={summary.originalScore}
            label={summary.originalLabel}
          />
          <span aria-hidden className="text-2xl text-zinc-300 dark:text-zinc-600">
            →
          </span>
          <ScoreColumn
            caption="After"
            score={summary.humanizedScore}
            label={summary.humanizedLabel}
          />
        </div>

        {/* Both bars share one 0-100 axis so the gap is readable at a glance,
            while the exact numbers stay visible above. */}
        <div className="mt-5 space-y-2">
          <TrackRow caption="Original" score={summary.originalScore} />
          <TrackRow caption="Humanized" score={summary.humanizedScore} />
        </div>

        <div
          className={`mt-4 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${change.className}`}
        >
          <span aria-hidden>{change.arrow}</span>
          <span>{changeText(summary)}</span>
        </div>

        {/* Only worth showing once refinement has actually happened; a single
            pass is already fully described by the numbers above. */}
        {passes.length > 1 && (
          <div className="mt-4 space-y-1 border-t border-zinc-200 pt-3 dark:border-zinc-700">
            {passes.map((p) => {
              const delta = p.before - p.after;
              return (
                <div
                  key={p.pass}
                  className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400"
                >
                  <span className="w-14 shrink-0">Pass {p.pass}</span>
                  <span className="tabular-nums">
                    {p.before}% → {p.after}%
                  </span>
                  <span
                    className={`tabular-nums ${
                      delta > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : delta < 0
                          ? "text-red-600 dark:text-red-400"
                          : ""
                    }`}
                  >
                    {delta > 0 ? "↓" : delta < 0 ? "↑" : "→"}
                    {Math.abs(delta)}
                  </span>
                  {!p.accepted && (
                    <span className="text-zinc-400 dark:text-zinc-500">(not kept)</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {summary.lowConfidence && (
          <p className="mt-3 text-center text-xs text-amber-700 dark:text-amber-400">
            Very short text — this estimate is low confidence and may not be meaningful.
          </p>
        )}

        <p className="mt-3 text-center text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Estimate based on writing patterns such as sentence variation, repetition and
          formulaic phrasing. Not proof of AI or human authorship.
        </p>
      </div>
    </div>
  );
}
