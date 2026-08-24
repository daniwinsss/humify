"use client";

import { useCallback, useRef, useState } from "react";

interface DocumentUploadProps {
  file: File | null;
  onSelect: (file: File | null) => void;
  disabled?: boolean;
  accept: string[];
  maxBytes: number;
  maxBytesLabel: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentUpload({
  file,
  onSelect,
  disabled,
  accept,
  maxBytes,
  maxBytesLabel,
}: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState("");

  const validate = useCallback(
    (candidate: File): string => {
      const dot = candidate.name.lastIndexOf(".");
      const ext = dot === -1 ? "" : candidate.name.slice(dot).toLowerCase();

      if (!accept.includes(ext)) {
        return `${ext || "That file"} isn't supported. Use ${accept.join(", ")}.`;
      }
      if (candidate.size === 0) return "That file is empty.";
      if (candidate.size > maxBytes) {
        return `That file is ${formatBytes(candidate.size)}. The limit is ${maxBytesLabel}.`;
      }
      return "";
    },
    [accept, maxBytes, maxBytesLabel]
  );

  const accept_ = useCallback(
    (candidate: File | undefined) => {
      if (!candidate) return;
      const issue = validate(candidate);
      setProblem(issue);
      onSelect(issue ? null : candidate);
    },
    [onSelect, validate]
  );

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Upload a document</span>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) accept_(e.dataTransfer.files[0]);
        }}
        className={`rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
          dragging
            ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/40"
            : "border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
        } ${disabled ? "opacity-50" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept.join(",")}
          disabled={disabled}
          onChange={(e) => accept_(e.target.files?.[0])}
          className="sr-only"
          id="document-file"
        />

        {file ? (
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{file.name}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatBytes(file.size)}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              Ready
            </p>
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                setProblem("");
                if (inputRef.current) inputRef.current.value = "";
              }}
              disabled={disabled}
              className="mt-2 text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-700 disabled:cursor-not-allowed dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Choose a different file
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 dark:text-zinc-600"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Drag &amp; drop, or{" "}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled}
                className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700 disabled:cursor-not-allowed dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                upload a document
              </button>
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              {accept.join(", ")} · up to {maxBytesLabel}
            </p>
          </div>
        )}
      </div>

      {problem && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
