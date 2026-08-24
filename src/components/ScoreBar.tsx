"use client";

interface ScoreBarProps {
  label: string;
  score: number;
  sublabel?: string;
  comparison?: number;
}

function getColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function getTextColor(score: number): string {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export default function ScoreBar({ label, score, sublabel, comparison }: ScoreBarProps) {
  const delta = comparison !== undefined ? score - comparison : undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${getTextColor(score)}`}>
            {score}
          </span>
          {delta !== undefined && delta !== 0 && (
            <span
              className={`text-xs font-medium ${
                delta > 0
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
          className={`h-full rounded-full transition-all duration-500 ${getColor(score)}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      {sublabel && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{sublabel}</p>
      )}
    </div>
  );
}
