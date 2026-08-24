"use client";

import { useState, useEffect } from "react";
import type { WritingProfile } from "@/types";

/** Returns null on failure — loading profiles is non-critical, so the list is left alone. */
async function fetchProfiles(): Promise<WritingProfile[] | null> {
  try {
    const res = await fetch("/api/profiles");
    const data = await res.json();
    return data.profiles || [];
  } catch {
    return null;
  }
}

interface ProfileManagerProps {
  onSelectProfile: (profileId: number | null) => void;
  selectedProfileId: number | null;
  disabled?: boolean;
}

export default function ProfileManager({
  onSelectProfile,
  selectedProfileId,
  disabled,
}: ProfileManagerProps) {
  const [profiles, setProfiles] = useState<WritingProfile[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState("neutral");
  const [formality, setFormality] = useState(50);
  const [customInstructions, setCustomInstructions] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchProfiles().then((loaded) => {
      if (!cancelled && loaded) setProfiles(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, tone, formality, customInstructions }),
      });
      if (res.ok) {
        const profile = await res.json();
        setProfiles((prev) => [profile, ...prev]);
        setName("");
        setDescription("");
        setTone("neutral");
        setFormality(50);
        setCustomInstructions("");
        setShowCreate(false);
      }
    } catch {
      // Non-critical
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await fetch(`/api/profiles?id=${id}`, { method: "DELETE" });
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      if (selectedProfileId === id) onSelectProfile(null);
    } catch {
      // Non-critical
    }
  }

  const formalityLabel =
    formality <= 20 ? "Very Informal" :
    formality <= 40 ? "Informal" :
    formality <= 60 ? "Neutral" :
    formality <= 80 ? "Formal" :
    "Very Formal";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Writing profile
        </label>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          {showCreate ? "Cancel" : "+ New profile"}
        </button>
      </div>

      {showCreate && (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
          <input
            type="text"
            placeholder="Profile name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="neutral">Neutral</option>
                <option value="confident">Confident</option>
                <option value="empathetic">Empathetic</option>
                <option value="enthusiastic">Enthusiastic</option>
                <option value="authoritative">Authoritative</option>
                <option value="witty">Witty</option>
                <option value="humble">Humble</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                Formality: {formalityLabel}
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={formality}
                onChange={(e) => setFormality(Number(e.target.value))}
                className="mt-2 w-full accent-indigo-500"
              />
            </div>
          </div>
          <textarea
            placeholder="Custom instructions (optional)"
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
          <button
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create Profile"}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onSelectProfile(null)}
          disabled={disabled}
          className={`rounded-xl border px-3 py-2 text-sm transition-all disabled:opacity-50 ${
            selectedProfileId === null
              ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-300"
              : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600"
          }`}
        >
          Use style preset
        </button>
        {profiles.map((profile) => (
          <div key={profile.id} className="group relative">
            <button
              onClick={() => onSelectProfile(profile.id)}
              disabled={disabled}
              className={`rounded-xl border px-3 py-2 text-left text-sm transition-all disabled:opacity-50 ${
                selectedProfileId === profile.id
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-300"
                  : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600"
              }`}
              title={profile.description || `${profile.tone} · Formality: ${profile.formality}%`}
            >
              {profile.name}
            </button>
            <button
              onClick={() => handleDelete(profile.id)}
              className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600 group-hover:block"
              title="Delete profile"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
