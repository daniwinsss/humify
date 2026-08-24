"use client";

import { useId, useState } from "react";

interface InfoTooltipProps {
  text: string;
  label?: string;
}

/**
 * Minimal hover/focus hint.
 *
 * The project has no tooltip primitive, so this is a deliberately small one:
 * a real button (keyboard reachable), described by the popup via aria-describedby,
 * and dismissible with Escape. No dependency, no portal.
 */
export default function InfoTooltip({ text, label = "More information" }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        // Opens rather than toggles: on a pointer device the hover handler has
        // already opened it, so a toggle here would close it on the very click
        // meant to open it. Touch devices have no hover, so this is their path in.
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-zinc-300 text-[10px] font-semibold leading-none text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
      >
        i
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute right-0 top-6 z-20 w-64 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-xs font-normal leading-relaxed text-zinc-600 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          {text}
        </span>
      )}
    </span>
  );
}
