"use client";

import type { Style } from "@/types";

const styles: { value: Style; label: string; description: string }[] = [
  { value: "professional", label: "Professional", description: "Clear & polished" },
  { value: "casual", label: "Casual", description: "Relaxed & natural" },
  { value: "academic", label: "Academic", description: "Formal & scholarly" },
  { value: "friendly", label: "Friendly", description: "Warm & approachable" },
];

interface StyleSelectorProps {
  selected: Style;
  onChange: (style: Style) => void;
  disabled?: boolean;
}

export default function StyleSelector({ selected, onChange, disabled }: StyleSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Writing style
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {styles.map((style) => (
          <button
            key={style.value}
            onClick={() => onChange(style.value)}
            disabled={disabled}
            className={`rounded-xl border px-3 py-2.5 text-left transition-all disabled:opacity-50 ${
              selected === style.value
                ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-300"
                : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
            }`}
          >
            <div className="text-sm font-medium">{style.label}</div>
            <div className="text-xs opacity-70">{style.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
