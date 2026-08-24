"use client";

import { useState, useEffect } from "react";
import type { ApiKey } from "@/types";

export default function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchKeys();
  }, []);

  async function fetchKeys() {
    try {
      const res = await fetch("/api/keys");
      const data = await res.json();
      setKeys(data.keys || []);
    } catch {
      // Non-critical
    }
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const key = await res.json();
        setNewKey(key.key);
        setName("");
        fetchKeys();
      }
    } catch {
      // Non-critical
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await fetch(`/api/keys?id=${id}`, { method: "DELETE" });
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch {
      // Non-critical
    }
  }

  async function handleCopy() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          API Keys
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Use keys to access the <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">POST /api/v1/rewrite</code> endpoint.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Key name (e.g. my-app)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
        <button
          onClick={handleCreate}
          disabled={!name.trim() || creating}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {creating ? "..." : "Create"}
        </button>
      </div>

      {newKey && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/50">
          <p className="mb-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            Copy your key now — it won&apos;t be shown again:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-white px-2 py-1 text-xs text-emerald-800 dark:bg-zinc-900 dark:text-emerald-300">
              {newKey}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-lg border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {keys.length > 0 && (
        <div className="space-y-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {k.name}
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  <code>{k.key}</code>
                  {k.last_used && ` · Last used ${k.last_used}`}
                </p>
              </div>
              <button
                onClick={() => handleDelete(k.id)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                title="Revoke key"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
