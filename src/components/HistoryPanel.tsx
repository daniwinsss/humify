"use client";

import type { RewriteEntry } from "@/types";
import HistoryItem from "./HistoryItem";

interface HistoryPanelProps {
  history: RewriteEntry[];
  onSelect: (entry: RewriteEntry) => void;
  onDelete: (id: number) => void;
}

export default function HistoryPanel({ history, onSelect, onDelete }: HistoryPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-3 font-display text-lg font-normal text-zinc-900 dark:text-zinc-50">
        History
        {history.length > 0 && (
          <span className="ml-2 text-xs font-normal text-zinc-400 dark:text-zinc-500">
            ({history.length})
          </span>
        )}
      </h2>
      {history.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-center text-sm text-zinc-400 dark:text-zinc-500">
            No rewrites yet.
            <br />
            Your history will appear here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto">
          {history.map((entry) => (
            <HistoryItem
              key={entry.id}
              entry={entry}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
