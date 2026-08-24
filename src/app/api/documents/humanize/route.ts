import { NextRequest, NextResponse } from "next/server";
import { getGeminiErrorDetails } from "@/lib/gemini";
import { getPositiveFeedbackExamples, getProfile, recordMetric, insertRewrite } from "@/lib/db";
import {
  stylePrompts,
  buildLanguageInstruction,
  buildProfilePrompt,
  buildFeedbackExamples,
} from "@/lib/prompts";
import { logger } from "@/lib/logger";
import { isDocumentError } from "@/lib/documents/common/errors";
import { MAX_FILE_BYTES, formatBytes, formatFromFilename } from "@/lib/documents/common/limits";
import type { DocumentFormat } from "@/lib/documents/common/types";
import { processDocument } from "@/lib/documents/process";
import { formatReportText } from "@/lib/documents/report";
import type { Style, Language } from "@/types";

export const runtime = "nodejs";

const ENDPOINT = "/api/documents/humanize";
const validStyles: Style[] = ["professional", "casual", "academic", "friendly"];
const validOutputs: DocumentFormat[] = ["html", "docx", "txt"];

/** A document can keep its own format or fall back to plain text. It cannot change type. */
const ALLOWED_OUTPUTS: Record<DocumentFormat, DocumentFormat[]> = {
  html: ["html", "txt"],
  docx: ["docx", "txt"],
  txt: ["txt"],
};

export async function POST(request: NextRequest) {
  const timer = logger.time("api.documents.humanize");

  const fail = async (status: number, error: string) => {
    await recordMetric({ endpoint: ENDPOINT, method: "POST", statusCode: status, durationMs: timer.error({ error }), error });
    return NextResponse.json({ error }, { status });
  };

  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail(400, "Expected a multipart form upload containing a file.");
    }

    const file = form.get("file");
    if (!file || typeof file === "string") {
      return fail(400, "No file was uploaded.");
    }

    if (file.size === 0) {
      return fail(400, "The uploaded file is empty.");
    }

    if (file.size > MAX_FILE_BYTES) {
      return fail(
        413,
        `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_FILE_BYTES)}.`
      );
    }

    const format = formatFromFilename(file.name);
    if (!format) {
      return fail(415, `Unsupported file type. Upload a .html, .htm, .docx, or .txt file.`);
    }

    const requestedOutput = form.get("outputFormat");
    let outputFormat: DocumentFormat = format;
    if (typeof requestedOutput === "string" && requestedOutput.length > 0) {
      if (!validOutputs.includes(requestedOutput as DocumentFormat)) {
        return fail(400, `Invalid output format. Must be one of: ${validOutputs.join(", ")}.`);
      }
      outputFormat = requestedOutput as DocumentFormat;
      if (!ALLOWED_OUTPUTS[format].includes(outputFormat)) {
        return fail(
          400,
          `A .${format} document can only be exported as ${ALLOWED_OUTPUTS[format].map((f) => `.${f}`).join(" or ")}.`
        );
      }
    }

    const style = (form.get("style") as Style | null) ?? "professional";
    const language = (form.get("language") as Language | null) ?? "auto";
    const profileIdRaw = form.get("profileId");
    const profileId =
      typeof profileIdRaw === "string" && profileIdRaw.length > 0
        ? Number.parseInt(profileIdRaw, 10)
        : undefined;

    if (!profileId && !validStyles.includes(style)) {
      return fail(400, "Invalid style. Must be: professional, casual, academic, or friendly");
    }

    if (!process.env.GEMINI_API_KEY) {
      return fail(500, "GEMINI_API_KEY is not configured");
    }

    // Prompt composition is identical to /api/rewrite, so documents inherit the same voice.
    let systemPrompt: string;
    const effectiveStyle = validStyles.includes(style) ? style : "professional";

    if (profileId) {
      const profile = await getProfile(profileId);
      if (!profile) return fail(404, "Profile not found");
      systemPrompt = buildProfilePrompt(profile);
    } else {
      systemPrompt = stylePrompts[effectiveStyle];
    }

    systemPrompt += buildLanguageInstruction(language);
    systemPrompt += buildFeedbackExamples(await getPositiveFeedbackExamples(effectiveStyle));

    const buffer = Buffer.from(await file.arrayBuffer());

    logger.info("documents.upload", {
      filename: file.name,
      format,
      outputFormat,
      bytes: file.size,
      style: effectiveStyle,
      language,
    });

    const result = await processDocument({
      filename: file.name,
      format,
      buffer,
      systemPrompt,
      outputFormat,
    });

    const duration = timer.end({
      filename: file.name,
      format,
      blocks: result.stats.blocks,
      geminiCalls: result.stats.geminiCalls,
    });

    await recordMetric({
      endpoint: ENDPOINT,
      method: "POST",
      statusCode: 200,
      durationMs: duration,
      inputChars: result.stats.charsIn,
      outputChars: result.stats.charsOut,
      style: effectiveStyle,
      language,
    });

    if (result.textPreview.original && result.textPreview.humanized) {
      await insertRewrite(
        result.textPreview.original,
        result.textPreview.humanized,
        effectiveStyle,
        language
      );
    }

    return NextResponse.json({
      ...result,
      reportText: formatReportText(result.report),
    });
  } catch (error) {
    if (isDocumentError(error)) {
      return fail(error.status, error.message);
    }

    const details = getGeminiErrorDetails(error);
    if (details) {
      return fail(details.status, details.message);
    }

    logger.error("documents.humanize.failed", { error: String(error) });
    return fail(500, "Failed to process the document. Please try again.");
  }
}

/** Lets the UI show the accepted types and size limit without hardcoding them. */
export async function GET() {
  return NextResponse.json({
    maxBytes: MAX_FILE_BYTES,
    maxBytesLabel: formatBytes(MAX_FILE_BYTES),
    accept: [".html", ".htm", ".docx", ".txt"],
    outputs: ALLOWED_OUTPUTS,
  });
}
