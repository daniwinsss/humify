import { NextRequest, NextResponse } from "next/server";
import { getGeminiErrorDetails, rewriteText } from "@/lib/gemini";
import { validateApiKey } from "@/lib/db";
import { stylePrompts, buildLanguageInstruction } from "@/lib/prompts";
import type { Style, Language } from "@/types";

const validStyles: Style[] = ["professional", "casual", "academic", "friendly"];

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing API key. Use Authorization: Bearer <key>" },
        { status: 401 }
      );
    }

    const key = authHeader.slice(7);
    const apiKey = await validateApiKey(key);
    if (!apiKey) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    const body = await request.json();
    const { text, style = "professional", language = "auto" } = body as {
      text: string;
      style?: Style;
      language?: Language;
    };

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    if (!validStyles.includes(style)) {
      return NextResponse.json(
        { error: `Invalid style. Must be one of: ${validStyles.join(", ")}` },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    const prompt = stylePrompts[style] + buildLanguageInstruction(language);
    const rewritten = await rewriteText(text.trim(), prompt);

    return NextResponse.json({
      original: text.trim(),
      rewritten,
      style,
      language,
    });
  } catch (error) {
    const errorDetails = getGeminiErrorDetails(error);
    console.error("API v1 rewrite error:", error);
    return NextResponse.json(
      { error: errorDetails?.message ?? "Failed to rewrite text" },
      { status: errorDetails?.status ?? 500 }
    );
  }
}
