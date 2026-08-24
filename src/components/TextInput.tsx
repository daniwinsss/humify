"use client";

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function TextInput({ value, onChange, disabled }: TextInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="input-text"
        className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        Paste your text
      </label>
      <textarea
        id="input-text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Paste your AI-generated text here..."
        rows={8}
        className="w-full resize-y rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-zinc-900 placeholder-zinc-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-600 dark:focus:border-indigo-400"
      />
      <p className="text-right text-xs text-zinc-400 dark:text-zinc-500">
        {value.length} characters
      </p>
    </div>
  );
}
