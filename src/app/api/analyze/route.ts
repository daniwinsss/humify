import { NextRequest, NextResponse } from "next/server";
import { analyzeText, getGeminiErrorDetails } from "@/lib/gemini";
import { recordMetric } from "@/lib/db";
import { analyzeAILikelihood } from "@/lib/analysis";
import { getUserFromHeaders } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const user = getUserFromHeaders(request.headers);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const timer = logger.time("api.analyze");

  try {
    const body = await request.json();
    const { text } = body as { text: string };

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      await recordMetric({ endpoint: "/api/analyze", method: "POST", statusCode: 400, durationMs: timer.error(), error: "Text is required" });
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      await recordMetric({ endpoint: "/api/analyze", method: "POST", statusCode: 500, durationMs: timer.error(), error: "GEMINI_API_KEY not configured" });
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    const analysis = await analyzeText(text.trim());

    // Computed locally and merged in, so the dashboard carries the AI-likelihood
    // estimate alongside the model-derived metrics without a second round trip.
    analysis.aiLikelihood = analyzeAILikelihood(text.trim());
    const duration = timer.end({ inputChars: text.trim().length });
    await recordMetric({ endpoint: "/api/analyze", method: "POST", statusCode: 200, durationMs: duration, inputChars: text.trim().length });

    return NextResponse.json(analysis);
  } catch (error) {
    const errorDetails = getGeminiErrorDetails(error);
    const duration = timer.error({ error: String(error) });
    const status = errorDetails?.status ?? 500;
    await recordMetric({ endpoint: "/api/analyze", method: "POST", statusCode: status, durationMs: duration, error: String(error) });
    return NextResponse.json(
      { error: errorDetails?.message ?? "Failed to analyze text. Please try again." },
      { status }
    );
  }
}
