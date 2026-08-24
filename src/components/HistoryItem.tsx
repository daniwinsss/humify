"use client";

import type { RewriteEntry } from "@/types";

const styleBadgeColors: Record<string, string> = {
  professional: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  casual: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  academic: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  friendly: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

interface HistoryItemProps {
  entry: RewriteEntry;
  onSelect: (entry: RewriteEntry) => void;
  onDelete: (id: number) => void;
}

export default function HistoryItem({ entry, onSelect, onDelete }: HistoryItemProps) {
  const preview = entry.original.length > 80
    ? entry.original.slice(0, 80) + "..."
    : entry.original;

  const date = new Date(entry.created_at + "Z");
  const timeAgo = formatTimeAgo(date);

  return (
    <div
      onClick={() => onSelect(entry)}
      className="group flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${styleBadgeColors[entry.style] || ""}`}>
            {entry.style}
          </span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {timeAgo}
          </span>
          {/* Only rendered when the record actually carries scores. Entries saved
              before the AI-likelihood feature store nulls and show nothing. */}
          {typeof entry.ai_likelihood_difference === "number" && (
            <span
              title="Change in AI-likelihood estimate"
              className="text-[10px] font-medium tabular-nums text-zinc-400 dark:text-zinc-500"
            >
              {entry.ai_likelihood_difference > 0 ? "↓" : entry.ai_likelihood_difference < 0 ? "↑" : "→"}
              {Math.abs(entry.ai_likelihood_difference)}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">
          {preview}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(entry.id);
        }}
        className="shrink-0 rounded-md p-1 text-zinc-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-950 dark:hover:text-red-400"
        aria-label="Delete"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
      </button>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
