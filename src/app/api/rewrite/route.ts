import { NextRequest, NextResponse } from "next/server";
import { getGeminiErrorDetails, rewriteText } from "@/lib/gemini";
import { insertRewrite, getPositiveFeedbackExamples, getProfile, recordMetric } from "@/lib/db";
import { stylePrompts, buildLanguageInstruction, buildProfilePrompt, buildFeedbackExamples, buildRefinementPrompt, buildSignalGuidance } from "@/lib/prompts";
import { analyzeAILikelihood, compareAILikelihood, toSummary } from "@/lib/analysis";
import { getUserFromHeaders } from "@/lib/auth";
import { logger } from "@/lib/logger";
import type { Style, Language } from "@/types";

const validStyles: Style[] = ["professional", "casual", "academic", "friendly"];

export async function POST(request: NextRequest) {
  const timer = logger.time("api.rewrite");
  const user = getUserFromHeaders(request.headers);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { text, style, language = "auto", profileId, suggestions, baselineText, refine } = body as {
      text: string;
      style: Style;
      language?: Language;
      profileId?: number;
      /** Improvements for this pass to apply. Absent on a first pass. */
      suggestions?: string[];
      /** Marks this as a refinement pass, which adds signal-targeted guidance. */
      refine?: boolean;
      /**
       * The user's true original. On a refinement pass `text` is the previous
       * pass's output, so without this the before/after would re-anchor each time
       * and report a shrinking per-pass delta instead of cumulative progress.
       */
      baselineText?: string;
    };

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      await recordMetric({ endpoint: "/api/rewrite", method: "POST", statusCode: 400, durationMs: timer.error(), error: "Text is required" });
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (!profileId && (!style || !validStyles.includes(style))) {
      await recordMetric({ endpoint: "/api/rewrite", method: "POST", statusCode: 400, durationMs: timer.error(), error: "Invalid style" });
      return NextResponse.json(
        { error: "Invalid style. Must be: professional, casual, academic, or friendly" },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      await recordMetric({ endpoint: "/api/rewrite", method: "POST", statusCode: 500, durationMs: timer.error(), error: "GEMINI_API_KEY not configured" });
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    let basePrompt: string;
    const effectiveStyle = style || "professional";

    if (profileId) {
      const profile = await getProfile(profileId);
      if (!profile) {
        await recordMetric({ endpoint: "/api/rewrite", method: "POST", statusCode: 404, durationMs: timer.error(), error: "Profile not found" });
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      }
      basePrompt = buildProfilePrompt(profile);
    } else {
      basePrompt = stylePrompts[effectiveStyle];
    }

    basePrompt += buildLanguageInstruction(language);

    const feedbackExamples = await getPositiveFeedbackExamples(effectiveStyle);
    basePrompt += buildFeedbackExamples(feedbackExamples);

    // Both are empty strings on a first pass, so it composes exactly as it did
    // before this feature existed.
    if (refine) {
      // Signals of the text going INTO this pass, so the guidance targets what is
      // actually still wrong with it. Local and deterministic — no extra API call.
      basePrompt += buildSignalGuidance(analyzeAILikelihood(text.trim()).signals);
    }
    basePrompt += buildRefinementPrompt(suggestions ?? []);

    // Falls back to `text` for a first pass, where the input IS the baseline.
    const baseline =
      typeof baselineText === "string" && baselineText.trim().length > 0
        ? baselineText.trim()
        : text.trim();
    const isRefinement = refine === true;

    logger.info("rewrite.start", { style: effectiveStyle, language, inputChars: text.trim().length, profileId, isRefinement });

    const rewritten = await rewriteText(text.trim(), basePrompt);

    // Deterministic and local, so scoring both texts here costs no extra request
    // and no extra latency. Doing it in this route also means the client gets the
    // before/after comparison with the rewrite itself rather than re-analyzing.
    const aiLikelihood = compareAILikelihood(baseline, rewritten);

    // Stored against the baseline so a history row holds the whole journey
    // (true original -> latest output) and its score columns stay consistent
    // with the two texts stored beside them.
    const entry = await insertRewrite(baseline, rewritten, effectiveStyle, language, {
      original: aiLikelihood.original.score,
      humanized: aiLikelihood.humanized.score,
      difference: aiLikelihood.difference,
    }, user.userId);

    const duration = timer.end({ style: effectiveStyle, language, inputChars: text.trim().length, outputChars: rewritten.length });
    await recordMetric({
      endpoint: "/api/rewrite", method: "POST", statusCode: 200, durationMs: duration,
      inputChars: text.trim().length, outputChars: rewritten.length, style: effectiveStyle, language,
    });

    // Only the summary crosses the wire: raw signal breakdowns are an internal
    // implementation detail of the estimator, not part of the API contract.
    return NextResponse.json({ ...entry, aiLikelihood: toSummary(aiLikelihood) });
  } catch (error) {
    const errorDetails = getGeminiErrorDetails(error);
    const duration = timer.error({ error: String(error) });
    const status = errorDetails?.status ?? 500;
    await recordMetric({ endpoint: "/api/rewrite", method: "POST", statusCode: status, durationMs: duration, error: String(error) });
    return NextResponse.json(
      { error: errorDetails?.message ?? "Failed to rewrite text. Please try again." },
      { status }
    );
  }
}
