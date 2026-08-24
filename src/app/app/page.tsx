"use client";

import { useState, useEffect } from "react";
import type { Style, RewriteEntry, TextAnalysis, Language, AILikelihoodSummary, RefinePass } from "@/types";
import Header from "@/components/Header";
import TextInput from "@/components/TextInput";
import StyleSelector from "@/components/StyleSelector";
import RewriteButton from "@/components/RewriteButton";
import ComparisonView from "@/components/ComparisonView";
import HistoryPanel from "@/components/HistoryPanel";
import AnalysisDashboard from "@/components/AnalysisDashboard";
import LanguageSelector from "@/components/LanguageSelector";
import ProfileManager from "@/components/ProfileManager";
import DocumentPanel from "@/components/DocumentPanel";
import AILikelihoodComparison from "@/components/analysis/AILikelihoodComparison";
import { takeDraft } from "@/lib/draft";
import { summaryFromStoredScores, shouldAcceptRefinement } from "@/lib/analysis";

type Mode = "text" | "document";

/** Returns null on failure — loading history is non-critical, so the list is left alone. */
async function fetchHistory(): Promise<RewriteEntry[] | null> {
  try {
    const res = await fetch("/api/history");
    const data = await res.json();
    return data.history || [];
  } catch {
    return null;
  }
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("text");
  const [inputText, setInputText] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<Style>("professional");
  const [rewrittenText, setRewrittenText] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<RewriteEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [originalAnalysis, setOriginalAnalysis] = useState<TextAnalysis | null>(null);
  const [rewrittenAnalysis, setRewrittenAnalysis] = useState<TextAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("auto");
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [lastRewriteId, setLastRewriteId] = useState<number | null>(null);
  const [aiLikelihood, setAiLikelihood] = useState<AILikelihoodSummary | null>(null);
  const [passes, setPasses] = useState<RefinePass[]>([]);
  const [isRefining, setIsRefining] = useState(false);
  const [rejectedPass, setRejectedPass] = useState<{ text: string; score: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHistory().then((entries) => {
      if (!cancelled && entries) setHistory(entries);
    });

    // Text typed into the landing-page hero, if the visitor arrived that way. A one-shot read of
    // external state, which is what an effect is for. It cannot move into a lazy useState
    // initializer: takeDraft() clears the key as it reads, and React invokes initializers twice
    // in development, so the second call would return "" and lose the draft.
    const draft = takeDraft();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (draft) setInputText(draft);

    return () => {
      cancelled = true;
    };
  }, []);

  async function fetchAnalysis(text: string): Promise<TextAnalysis | null> {
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async function handleAnalyze() {
    if (!inputText.trim()) return;

    setIsAnalyzing(true);
    setError("");

    // Analyze the humanized side too when there is one, so Analyze fills both
    // dashboard columns instead of leaving the comparison half-empty.
    const wantsRewritten = rewrittenText.trim().length > 0;
    const [origAnalysis, rewriteAnalysis] = await Promise.all([
      fetchAnalysis(inputText.trim()),
      wantsRewritten ? fetchAnalysis(rewrittenText.trim()) : Promise.resolve(null),
    ]);

    setIsAnalyzing(false);

    // fetchAnalysis returns null on failure. Overwriting with null would silently
    // wipe a perfectly good previous analysis and leave the dashboard blank with
    // no explanation, so a total failure reports itself and changes nothing.
    if (!origAnalysis && !rewriteAnalysis) {
      setError("Could not analyze the text right now. Please try again.");
      return;
    }

    setOriginalAnalysis(origAnalysis);
    setRewrittenAnalysis(wantsRewritten ? rewriteAnalysis : null);
  }

  async function handleRewrite() {
    if (!inputText.trim()) return;

    setIsLoading(true);
    setError("");
    setRewrittenText("");
    setOriginalAnalysis(null);
    setRewrittenAnalysis(null);
    setLastRewriteId(null);
    setAiLikelihood(null);
    setPasses([]);
    setRejectedPass(null);

    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText.trim(),
          style: selectedStyle,
          language: selectedLanguage,
          profileId: selectedProfileId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Rewrite failed");
      }

      setOriginalText(data.original);
      setRewrittenText(data.rewritten);
      setLastRewriteId(data.id);
      // Arrives with the rewrite itself, so the comparison paints immediately
      // instead of waiting on the two /api/analyze calls below.
      setAiLikelihood(data.aiLikelihood ?? null);
      if (data.aiLikelihood) {
        setPasses([
          {
            pass: 1,
            before: data.aiLikelihood.originalScore,
            after: data.aiLikelihood.humanizedScore,
            accepted: true,
          },
        ]);
      }
      setHistory((prev) => [data, ...prev]);

      setIsAnalyzing(true);
      const [origAnalysis, rewriteAnalysis] = await Promise.all([
        fetchAnalysis(data.original),
        fetchAnalysis(data.rewritten),
      ]);
      setOriginalAnalysis(origAnalysis);
      setRewrittenAnalysis(rewriteAnalysis);
      setIsAnalyzing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Run another humanization pass over the current output, applying the
   * suggestions the analysis produced for it.
   *
   * Keeps whichever version scores lower. A pass that raises the estimate is
   * recorded and reported rather than silently swapped in.
   */
  async function handleRefine() {
    const current = rewrittenText.trim();
    if (!current || isRefining || isLoading) return;

    const currentScore = aiLikelihood?.humanizedScore;
    if (currentScore === undefined) return;

    setIsRefining(true);
    setError("");
    setRejectedPass(null);

    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: current,
          // Keeps the before/after anchored to what the user actually typed.
          baselineText: originalText || current,
          style: selectedStyle,
          language: selectedLanguage,
          profileId: selectedProfileId,
          refine: true,
          suggestions: rewrittenAnalysis?.suggestions ?? [],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Refine failed");
      }

      const candidateScore: number | undefined = data.aiLikelihood?.humanizedScore;
      if (candidateScore === undefined) {
        throw new Error("Refine returned no score");
      }

      const accepted = shouldAcceptRefinement(currentScore, candidateScore);
      const passNumber = passes.length + 1;

      setPasses((prev) => [
        ...prev,
        { pass: passNumber, before: currentScore, after: candidateScore, accepted },
      ]);
      setHistory((prev) => [data, ...prev]);

      if (!accepted) {
        // Hold the candidate so the user can still take it deliberately.
        setRejectedPass({ text: data.rewritten, score: candidateScore });
        return;
      }

      setRewrittenText(data.rewritten);
      setLastRewriteId(data.id);
      setAiLikelihood(data.aiLikelihood);

      // Re-analyze the new output so the NEXT pass has fresh suggestions to act
      // on. This is what makes refinement iterative rather than a reroll.
      setIsAnalyzing(true);
      const refreshed = await fetchAnalysis(data.rewritten);
      setRewrittenAnalysis(refreshed);
      setIsAnalyzing(false);
    } catch (err) {
      // A failed pass must never cost the user the result they already have.
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsRefining(false);
    }
  }

  /** Take a pass that scored worse anyway — the user's call, not ours. */
  async function handleAcceptRejected() {
    if (!rejectedPass || !aiLikelihood) return;

    const taken = rejectedPass;
    setRejectedPass(null);
    setRewrittenText(taken.text);
    setAiLikelihood({
      ...aiLikelihood,
      humanizedScore: taken.score,
      difference: aiLikelihood.originalScore - taken.score,
    });
    setPasses((prev) =>
      prev.map((p, i) => (i === prev.length - 1 ? { ...p, accepted: true } : p))
    );

    setIsAnalyzing(true);
    const refreshed = await fetchAnalysis(taken.text);
    setRewrittenAnalysis(refreshed);
    setIsAnalyzing(false);
  }

  function handleSelectHistory(entry: RewriteEntry) {
    setOriginalText(entry.original);
    setRewrittenText(entry.rewritten);
    setInputText(entry.original);
    setSelectedStyle(entry.style);
    // Older records predate AI-likelihood scoring and store nulls; the helper
    // returns null for those and the comparison section simply does not render.
    setAiLikelihood(
      summaryFromStoredScores(entry.ai_likelihood_original, entry.ai_likelihood_humanized)
    );
    // Without this the previous text's metrics stay on screen next to the newly
    // loaded entry, silently mismatched.
    setOriginalAnalysis(null);
    setRewrittenAnalysis(null);
    setPasses([]);
    setRejectedPass(null);
    setShowHistory(false);
  }

  async function handleDeleteHistory(id: number) {
    try {
      await fetch(`/api/history/${id}`, { method: "DELETE" });
      setHistory((prev) => prev.filter((e) => e.id !== id));
    } catch {
      // Delete failure is non-critical
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-zinc-950">
      <Header
        actions={
          <button
            onClick={() => setShowHistory(true)}
            className="rounded-lg px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            History ({history.length})
          </button>
        }
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:px-8">
        <div className="flex flex-col gap-6">
          {/* Text and document modes share the style, language and profile controls below. */}
          <div className="mx-auto flex w-fit gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
            {(["text", "document"] as Mode[]).map((value) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                disabled={isLoading}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                  mode === value
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {value === "text" ? "Text" : "Document"}
              </button>
            ))}
          </div>

          {mode === "text" && (
            <TextInput
              value={inputText}
              onChange={setInputText}
              disabled={isLoading}
            />
          )}

          <ProfileManager
            onSelectProfile={setSelectedProfileId}
            selectedProfileId={selectedProfileId}
            disabled={isLoading}
          />

          {selectedProfileId === null && (
            <StyleSelector
              selected={selectedStyle}
              onChange={setSelectedStyle}
              disabled={isLoading}
            />
          )}

          <LanguageSelector
            selected={selectedLanguage}
            onChange={setSelectedLanguage}
            disabled={isLoading}
          />

          <div className="flex items-center gap-4">
            {mode === "text" && (
              <>
            <RewriteButton
              onClick={handleRewrite}
              disabled={!inputText.trim() || isLoading}
              loading={isLoading}
            />
            <button
              onClick={handleAnalyze}
              disabled={!inputText.trim() || isLoading || isAnalyzing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300 dark:hover:bg-violet-900/50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
              {isAnalyzing ? "Analyzing..." : "Analyze"}
            </button>
              </>
            )}
          </div>

          {mode === "text" ? (
            <>
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
                  {error}
                </div>
              )}

              <ComparisonView
                original={originalText}
                rewritten={rewrittenText}
                rewriteId={lastRewriteId ?? undefined}
                onRefine={aiLikelihood ? handleRefine : undefined}
                refining={isRefining}
              />

              {rejectedPass && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/20">
                  <p className="text-amber-800 dark:text-amber-300">
                    That pass raised the estimate to {rejectedPass.score}% — keeping the
                    previous version ({aiLikelihood?.humanizedScore}%).
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={handleRefine}
                      disabled={isRefining}
                      className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/40"
                    >
                      Try again
                    </button>
                    <button
                      onClick={handleAcceptRejected}
                      className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/40"
                    >
                      Use this anyway
                    </button>
                  </div>
                </div>
              )}

              <AILikelihoodComparison summary={aiLikelihood} passes={passes} />

              <AnalysisDashboard
                original={originalAnalysis}
                rewritten={rewrittenAnalysis}
                isLoading={isAnalyzing}
              />
            </>
          ) : (
            <DocumentPanel
              style={selectedStyle}
              language={selectedLanguage}
              profileId={selectedProfileId}
            />
          )}
        </div>
      </main>

      {/*
        One history surface at every width, opened from the nav. The centered single-column
        layout has no room for a permanent sidebar, and a drawer keeps the list identical on
        desktop and mobile instead of maintaining two copies of it.
      */}
      {showHistory && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowHistory(false)}
          />
          {/* HistoryPanel supplies the "History (n)" heading, so the drawer only adds a close. */}
          <div className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col overflow-y-auto bg-white p-5 shadow-2xl dark:bg-zinc-900">
            <button
              onClick={() => setShowHistory(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Close history"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
            </button>
            <HistoryPanel
              history={history}
              onSelect={handleSelectHistory}
              onDelete={handleDeleteHistory}
            />
          </div>
        </div>
      )}
    </div>
  );
}
