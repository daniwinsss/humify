"use client";

import { useState, useEffect } from "react";
import type { FeedbackRating } from "@/types";

interface FeedbackButtonsProps {
  rewriteId: number;
}

export default function FeedbackButtons({ rewriteId }: FeedbackButtonsProps) {
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/feedback?rewriteId=${rewriteId}`)
      .then((r) => r.json())
      .then((d) => setRating(d.feedback?.rating || null))
      .catch(() => {});
  }, [rewriteId]);

  async function handleRate(newRating: FeedbackRating) {
    setSaving(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewriteId, rating: newRating }),
      });
      setRating(newRating);
    } catch {
      // Non-critical
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 text-xs text-zinc-400 dark:text-zinc-500">
        Rate:
      </span>
      <button
        onClick={() => handleRate("positive")}
        disabled={saving}
        className={`rounded-lg p-1.5 transition-colors ${
          rating === "positive"
            ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400"
            : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        }`}
        title="Good rewrite"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>
      </button>
      <button
        onClick={() => handleRate("negative")}
        disabled={saving}
        className={`rounded-lg p-1.5 transition-colors ${
          rating === "negative"
            ? "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400"
            : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        }`}
        title="Bad rewrite"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/></svg>
      </button>
    </div>
  );
}
