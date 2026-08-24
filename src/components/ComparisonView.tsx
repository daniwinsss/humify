"use client";

import OutputActions from "./OutputActions";
import FeedbackButtons from "./FeedbackButtons";

interface ComparisonViewProps {
  original: string;
  rewritten: string;
  rewriteId?: number;
  /** Optional so DocumentPanel and other callers are unaffected. */
  onRefine?: () => void;
  refining?: boolean;
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export default function ComparisonView({
  original,
  rewritten,
  rewriteId,
  onRefine,
  refining = false,
}: ComparisonViewProps) {
  if (!rewritten) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-normal text-zinc-900 dark:text-zinc-50">
          Result
        </h2>
        <div className="flex items-center gap-3">
          {rewriteId && <FeedbackButtons rewriteId={rewriteId} />}
          {onRefine && (
            <button
              onClick={onRefine}
              disabled={refining}
              title="Rewrite again, applying the suggestions from the analysis below"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              {refining ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Refining...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                  Refine again
                </>
              )}
            </button>
          )}
          <OutputActions text={rewritten} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Original
            </span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {wordCount(original)} words
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {original}
          </p>
        </div>
        {/*
          Full-strength `bg-indigo-100`, not a tint: the accent and the neutral are both warm
          now, so this pane and the original beside it separate by lightness rather than hue.
        */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-100 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              Humanized
            </span>
            <span className="text-xs text-indigo-600 dark:text-indigo-500">
              {wordCount(rewritten)} words
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
            {rewritten}
          </p>
        </div>
      </div>
    </div>
  );
}
