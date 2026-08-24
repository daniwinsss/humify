"use client";

import type { TextAnalysis } from "@/types";
import ScoreBar from "./ScoreBar";
import InfoTooltip from "./analysis/InfoTooltip";
import {
  aiLikelihoodBarColor,
  aiLikelihoodTextColor,
  AI_LIKELIHOOD_DISCLAIMER,
} from "./analysis/scale";

interface AnalysisDashboardProps {
  original: TextAnalysis | null;
  rewritten: TextAnalysis | null;
  isLoading: boolean;
}

function ToneBar({ name, score }: { name: string; score: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-zinc-600 dark:text-zinc-400">
        {name}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className="h-full rounded-full bg-violet-500 transition-all duration-500"
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {score}
      </span>
    </div>
  );
}

/**
 * AI-likelihood row.
 *
 * Not a ScoreBar: that component paints high scores green because for every other
 * metric here higher is better. For AI-likelihood higher is the concerning
 * direction, so this row uses the inverted scale from ./analysis/scale.
 */
function AILikelihoodRow({
  score,
  comparison,
}: {
  score: number;
  comparison?: number;
}) {
  const delta = comparison !== undefined ? score - comparison : undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          AI-Likelihood
          <InfoTooltip text={AI_LIKELIHOOD_DISCLAIMER} label="About the AI-likelihood estimate" />
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${aiLikelihoodTextColor(score)}`}>
            {score}
          </span>
          {delta !== undefined && delta !== 0 && (
            <span
              className={`text-xs font-medium ${
                delta < 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {delta > 0 ? "+" : ""}
              {delta}
            </span>
          )}
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className={`h-full rounded-full transition-all duration-500 ${aiLikelihoodBarColor(score)}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Estimate from writing patterns — not proof of authorship
      </p>
    </div>
  );
}

function AnalysisColumn({
  analysis,
  label,
  comparison,
  accentBorder,
}: {
  analysis: TextAnalysis;
  label: string;
  comparison?: TextAnalysis | null;
  accentBorder?: boolean;
}) {
  return (
    <div
      className={`space-y-5 rounded-xl border p-4 ${
        accentBorder
          // Full-strength tint: accent and neutral are both warm, so this card separates from
          // the original beside it by lightness, not hue.
          ? "border-indigo-200 bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/20"
          : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50"
      }`}
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        {label}
      </span>

      <ScoreBar
        label="Readability"
        score={analysis.readability.score}
        sublabel={`${analysis.readability.grade} · ${analysis.readability.label}`}
        comparison={comparison?.readability.score}
      />

      <ScoreBar
        label="Formality"
        score={analysis.formality.score}
        sublabel={analysis.formality.label}
        comparison={comparison?.formality.score}
      />

      <ScoreBar
        label="Sentence Complexity"
        score={analysis.sentenceComplexity.score}
        sublabel={`Avg ${analysis.sentenceComplexity.avgLength} words/sentence · ${analysis.sentenceComplexity.label}`}
        comparison={comparison?.sentenceComplexity.score}
      />

      {/* Optional: payloads produced before this feature have no aiLikelihood. */}
      {analysis.aiLikelihood && (
        <AILikelihoodRow
          score={analysis.aiLikelihood.score}
          comparison={comparison?.aiLikelihood?.score}
        />
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Emotional Tone
          </span>
          <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
            {analysis.emotion.primary}
          </span>
        </div>
        <div className="space-y-1.5">
          {analysis.emotion.tones.map((tone) => (
            <ToneBar key={tone.name} name={tone.name} score={tone.score} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AnalysisDashboard({
  original,
  rewritten,
  isLoading,
}: AnalysisDashboardProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <svg
            className="h-5 w-5 animate-spin text-indigo-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            Analyzing text...
          </span>
        </div>
      </div>
    );
  }

  if (!original && !rewritten) return null;

  const showComparison = original && rewritten;
  const suggestions = rewritten?.suggestions ?? original?.suggestions ?? [];

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-normal text-zinc-900 dark:text-zinc-50">
        Writing Analysis
      </h2>

      <div className={`grid gap-4 ${showComparison ? "md:grid-cols-2" : "grid-cols-1"}`}>
        {original && (
          <AnalysisColumn
            analysis={original}
            label="Original"
            comparison={null}
          />
        )}
        {rewritten && (
          <AnalysisColumn
            analysis={rewritten}
            label="Humanized"
            comparison={original}
            accentBorder
          />
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
          <h3 className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
            Suggestions
          </h3>
          <ul className="space-y-1.5">
            {suggestions.map((suggestion, i) => (
              <li
                key={i}
                className="flex gap-2 text-sm text-amber-700 dark:text-amber-400"
              >
                <span className="shrink-0">-</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
