import { GoogleGenerativeAI } from "@google/generative-ai";
import type { TextAnalysis } from "@/types";

const FALLBACK_MODELS: string[] = (() => {
  const primary = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const defaults = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-lite-latest"];
  return [primary, ...defaults.filter(m => m !== primary)];
})();

export interface GeminiErrorDetails {
  status: number;
  message: string;
}

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenerativeAI(apiKey);
}

export function getGeminiErrorDetails(error: unknown): GeminiErrorDetails | null {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("[429 Too Many Requests]")) {
    const quotaMessage = message.toLowerCase().includes("prepayment credits are depleted")
      ? "Your Gemini credits are depleted. Add billing or switch to a key with available quota."
      : "Gemini quota was exceeded. Please wait a moment, then try again.";
    return { status: 429, message: quotaMessage };
  }

  if (message.includes("[503 Service Unavailable]")) {
    return {
      status: 503,
      message: "Gemini is currently overloaded. Please try again in a minute.",
    };
  }

  if (message.includes("[401") || message.includes("[403")) {
    return {
      status: 401,
      message: "Gemini rejected the API key. Check your key in .env.local.",
    };
  }

  if (message.includes("[GoogleGenerativeAI Error]")) {
    return {
      status: 500,
      message: "Failed to contact Gemini. Please try again.",
    };
  }

  return null;
}

async function tryWithFallback(
  systemInstruction: string,
  content: string
): Promise<string> {
  let lastError: unknown;
  for (const modelName of FALLBACK_MODELS) {
    try {
      const model = getClient().getGenerativeModel({ model: modelName, systemInstruction });
      const result = await model.generateContent(content);
      const text = result.response.text();
      if (!text) throw new Error("Empty response from Gemini");
      return text;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("[429") || msg.includes("[503") || msg.includes("[404")) {
        console.warn(`Model ${modelName} failed (${msg.slice(0, 80)}), trying next fallback`);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export async function rewriteText(
  text: string,
  systemPrompt: string
): Promise<string> {
  return tryWithFallback(systemPrompt, text);
}

const ANALYZE_PROMPT = `You are a writing analysis expert. Analyze the given text and return a JSON object with exactly this structure (no markdown, no code fences, just raw JSON):

{
  "readability": {
    "score": <number 0-100, where 100 is easiest to read, based on Flesch Reading Ease>,
    "grade": "<grade level like '8th grade' or 'College'>",
    "label": "<one of: Very Easy, Easy, Moderate, Difficult, Very Difficult>"
  },
  "formality": {
    "score": <number 0-100, where 0 is very informal and 100 is very formal>,
    "label": "<one of: Very Informal, Informal, Neutral, Formal, Very Formal>"
  },
  "emotion": {
    "primary": "<dominant emotional tone, e.g. Neutral, Confident, Enthusiastic, Analytical, Empathetic>",
    "confidence": <number 0-100>,
    "tones": [
      {"name": "<tone name>", "score": <number 0-100>}
    ]
  },
  "sentenceComplexity": {
    "score": <number 0-100, where 100 is most complex>,
    "label": "<one of: Simple, Moderate, Complex, Very Complex>",
    "avgLength": <average words per sentence as integer>,
    "longestSentence": <word count of longest sentence as integer>
  },
  "suggestions": [
    "<actionable suggestion for improving naturalness, max 5 suggestions>"
  ]
}

Return between 2 and 5 tones in the tones array, ordered by score descending.
Return between 1 and 5 suggestions. Focus suggestions on making the text sound more natural and human.
Be accurate and consistent in your scoring.`;

export async function analyzeText(text: string): Promise<TextAnalysis> {
  const response = await tryWithFallback(ANALYZE_PROMPT, text);
  const cleaned = response.replace(/```json\s*|```\s*/g, "").trim();
  return JSON.parse(cleaned) as TextAnalysis;
}
