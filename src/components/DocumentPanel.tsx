"use client";

import { useEffect, useState } from "react";
import type { Style, Language, AILikelihoodSummary, AILikelihoodResult, RefinePass, TextAnalysis } from "@/types";
import type { DocumentFormat, DocumentResult } from "@/lib/documents/common/types";
import DocumentUpload from "./DocumentUpload";
import FormattingReport from "./FormattingReport";
import AILikelihoodComparison from "./analysis/AILikelihoodComparison";

interface DocumentPanelProps {
  style: Style;
  language: Language;
  profileId: number | null;
  disabled?: boolean;
}

interface DocumentResponse extends DocumentResult {
  reportText: string;
}

interface UploadConfig {
  accept: string[];
  maxBytes: number;
  maxBytesLabel: string;
  outputs: Record<string, DocumentFormat[]>;
}

const FALLBACK_CONFIG: UploadConfig = {
  accept: [".html", ".htm", ".docx", ".txt"],
  maxBytes: 10 * 1024 * 1024,
  maxBytesLabel: "10.0 MB",
  outputs: { html: ["html", "txt"], docx: ["docx", "txt"], txt: ["txt"] },
};

const FORMAT_LABELS: Record<DocumentFormat, string> = {
  html: "HTML",
  docx: "DOCX",
  txt: "Plain text",
};

function extensionOf(name: string): DocumentFormat | null {
  const dot = name.lastIndexOf(".");
  const ext = dot === -1 ? "" : name.slice(dot).toLowerCase();
  if (ext === ".html" || ext === ".htm") return "html";
  if (ext === ".docx") return "docx";
  if (ext === ".txt") return "txt";
  return null;
}

function buildSummary(
  original: AILikelihoodResult,
  humanized: AILikelihoodResult
): AILikelihoodSummary {
  const difference = original.score - humanized.score;
  const significantChange = 10;
  const interpretation =
    difference > significantChange
      ? ("significant_reduction" as const)
      : difference < -significantChange
        ? ("increase" as const)
        : ("minimal_change" as const);
  return {
    originalScore: original.score,
    humanizedScore: humanized.score,
    originalLabel: original.label,
    humanizedLabel: humanized.label,
    difference,
    interpretation,
    lowConfidence: original.lowConfidence || humanized.lowConfidence,
  };
}

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

export default function DocumentPanel({ style, language, profileId, disabled }: DocumentPanelProps) {
  const [config, setConfig] = useState<UploadConfig>(FALLBACK_CONFIG);
  const [file, setFile] = useState<File | null>(null);
  const [outputFormat, setOutputFormat] = useState<DocumentFormat | null>(null);
  const [result, setResult] = useState<DocumentResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);

  const [aiLikelihood, setAiLikelihood] = useState<AILikelihoodSummary | null>(null);
  const [passes, setPasses] = useState<RefinePass[]>([]);
  const [isRefining, setIsRefining] = useState(false);
  const [rejectedPass, setRejectedPass] = useState<{
    result: DocumentResponse;
    score: number;
  } | null>(null);
  const [baselineOriginalScore, setBaselineOriginalScore] = useState<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/documents/humanize")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setConfig(data))
      .catch(() => {});
  }, []);

  const inputFormat = file ? extensionOf(file.name) : null;
  const outputChoices = inputFormat ? (config.outputs[inputFormat] ?? [inputFormat]) : [];
  const effectiveOutput = outputFormat && outputChoices.includes(outputFormat) ? outputFormat : inputFormat;

  function handleSelect(next: File | null) {
    setFile(next);
    setResult(null);
    setError("");
    setOutputFormat(null);
    setAiLikelihood(null);
    setPasses([]);
    setRejectedPass(null);
    setSuggestions([]);
  }

  async function handleProcess() {
    if (!file) return;

    setIsProcessing(true);
    setError("");
    setResult(null);
    setAiLikelihood(null);
    setPasses([]);
    setRejectedPass(null);
    setSuggestions([]);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("style", style);
      form.append("language", language);
      if (profileId) form.append("profileId", String(profileId));
      if (effectiveOutput) form.append("outputFormat", effectiveOutput);

      const res = await fetch("/api/documents/humanize", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Document processing failed");
      const docResult = data as DocumentResponse;
      setResult(docResult);

      if (
        docResult.textPreview.original.length > 0 &&
        docResult.textPreview.humanized.length > 0
      ) {
        setIsAnalyzing(true);
        const [origAnalysis, humanizedAnalysis] = await Promise.all([
          fetchAnalysis(docResult.textPreview.original),
          fetchAnalysis(docResult.textPreview.humanized),
        ]);

        if (origAnalysis?.aiLikelihood && humanizedAnalysis?.aiLikelihood) {
          const summary = buildSummary(
            origAnalysis.aiLikelihood,
            humanizedAnalysis.aiLikelihood
          );
          setAiLikelihood(summary);
          setBaselineOriginalScore(summary.originalScore);
          setPasses([
            {
              pass: 1,
              before: summary.originalScore,
              after: summary.humanizedScore,
              accepted: true,
            },
          ]);
        }
        if (humanizedAnalysis?.suggestions) {
          setSuggestions(humanizedAnalysis.suggestions);
        }
        setIsAnalyzing(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleRefine() {
    if (!file || !result || isRefining || isProcessing) return;

    const currentScore = aiLikelihood?.humanizedScore;
    if (currentScore === undefined) return;

    setIsRefining(true);
    setError("");
    setRejectedPass(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("style", style);
      form.append("language", language);
      if (profileId) form.append("profileId", String(profileId));
      if (effectiveOutput) form.append("outputFormat", effectiveOutput);

      const res = await fetch("/api/documents/humanize", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Refine failed");
      const docResult = data as DocumentResponse;

      if (docResult.textPreview.humanized.length === 0) {
        throw new Error("Refine returned empty text");
      }

      const humanizedAnalysis = await fetchAnalysis(docResult.textPreview.humanized);
      const candidateScore = humanizedAnalysis?.aiLikelihood?.score;

      if (candidateScore === undefined) {
        throw new Error("Refine returned no score");
      }

      const accepted = candidateScore < currentScore;
      const passNumber = passes.length + 1;

      setPasses((prev) => [
        ...prev,
        { pass: passNumber, before: currentScore, after: candidateScore, accepted },
      ]);

      if (!accepted) {
        setRejectedPass({ result: docResult, score: candidateScore });
        return;
      }

      setResult(docResult);
      setAiLikelihood({
        ...aiLikelihood!,
        humanizedScore: candidateScore,
        humanizedLabel: humanizedAnalysis!.aiLikelihood!.label,
        difference: baselineOriginalScore - candidateScore,
        interpretation:
          baselineOriginalScore - candidateScore > 10
            ? "significant_reduction"
            : candidateScore - baselineOriginalScore > 10
              ? "increase"
              : "minimal_change",
      });
      if (humanizedAnalysis?.suggestions) {
        setSuggestions(humanizedAnalysis.suggestions);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsRefining(false);
    }
  }

  function handleAcceptRejected() {
    if (!rejectedPass || !aiLikelihood) return;

    const { result: rejResult, score } = rejectedPass;
    setRejectedPass(null);
    setResult(rejResult);
    setAiLikelihood({
      ...aiLikelihood,
      humanizedScore: score,
      difference: baselineOriginalScore - score,
      interpretation:
        baselineOriginalScore - score > 10
          ? "significant_reduction"
          : score - baselineOriginalScore > 10
            ? "increase"
            : "minimal_change",
    });
    setPasses((prev) =>
      prev.map((p, i) => (i === prev.length - 1 ? { ...p, accepted: true } : p))
    );
  }

  function handleDownload() {
    if (!result) return;

    const bytes = Uint8Array.from(atob(result.dataBase64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: result.mimeType }));
    const link = document.createElement("a");
    link.href = url;
    link.download = result.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  const busy = disabled || isProcessing || isRefining;

  return (
    <div className="flex flex-col gap-6">
      <DocumentUpload
        file={file}
        onSelect={handleSelect}
        disabled={busy}
        accept={config.accept}
        maxBytes={config.maxBytes}
        maxBytesLabel={config.maxBytesLabel}
      />

      {file && outputChoices.length > 1 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Download as</span>
          <div className="flex flex-wrap gap-2">
            {outputChoices.map((choice) => (
              <button
                key={choice}
                onClick={() => setOutputFormat(choice)}
                disabled={busy}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                  effectiveOutput === choice
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-300"
                    : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {FORMAT_LABELS[choice]}
              </button>
            ))}
          </div>
          {effectiveOutput === "txt" && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Plain text discards all formatting. Pick {FORMAT_LABELS[inputFormat!]} to keep it.
            </p>
          )}
        </div>
      )}

      <button
        onClick={handleProcess}
        disabled={!file || busy}
        className="inline-flex w-fit items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isProcessing ? (
          <>
            <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            Humanizing document...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
            Humanize document
          </>
        )}
      </button>

      {(isProcessing || isRefining) && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Large documents are processed in batches and can take a minute.
        </p>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {error}
        </div>
      )}

      {result && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              Download {FORMAT_LABELS[result.report.format === "txt" ? "txt" : (effectiveOutput ?? result.report.format)]}
            </button>

            {aiLikelihood && (
              <button
                onClick={handleRefine}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
                title="Re-humanize the document and keep only if the AI-likelihood score drops"
              >
                {isRefining ? (
                  <>
                    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Refining...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                    Refine again
                  </>
                )}
              </button>
            )}

            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {result.filename} · {result.stats.blocks} blocks · {result.stats.runs} runs ·{" "}
              {result.stats.geminiCalls} Gemini call{result.stats.geminiCalls === 1 ? "" : "s"}
            </span>
          </div>

          <FormattingReport report={result.report} reportText={result.reportText} />

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

          {isAnalyzing && !aiLikelihood && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Analyzing AI-likelihood...
            </p>
          )}

          <AILikelihoodComparison summary={aiLikelihood} passes={passes} />

          {suggestions.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
              <h3 className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                Suggestions
              </h3>
              <ul className="space-y-1.5">
                {suggestions.map((suggestion, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm text-amber-700 dark:text-amber-400"
                  >
                    <span className="shrink-0">-</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.previewHtml !== undefined && (
            <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {showOriginal ? "Original document" : "Humanized document"}
                </h3>
                <button
                  onClick={() => setShowOriginal(!showOriginal)}
                  className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Show {showOriginal ? "humanized" : "original"}
                </button>
              </div>
              <div
                className="document-preview max-h-[28rem] overflow-auto rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-700"
                dangerouslySetInnerHTML={{
                  __html: (showOriginal ? result.originalPreviewHtml : result.previewHtml) ?? "",
                }}
              />
            </section>
          )}

          {result.previewHtml === undefined && result.textPreview.humanized.length > 0 && (
            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Original text</h3>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">
                  {result.textPreview.original}
                </pre>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Humanized text</h3>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs text-zinc-800 dark:text-zinc-200">
                  {result.textPreview.humanized}
                </pre>
              </div>
              <p className="text-xs text-zinc-500 md:col-span-2 dark:text-zinc-400">
                Word documents can&apos;t be rendered in the browser, so this shows the text only. The
                downloaded .docx keeps all of its original formatting — see the report above.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
