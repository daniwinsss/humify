import crypto from "crypto";
import { PrismaClient } from "@/generated/prisma";
import { PrismaNeon } from "@prisma/adapter-neon";
import type { RewriteEntry, Feedback, WritingProfile, ApiKey } from "@/types";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// --- Rewrites ---

export interface AILikelihoodRecord {
  original: number;
  humanized: number;
  difference: number;
}

export async function insertRewrite(
  original: string,
  rewritten: string,
  style: string,
  language: string = "auto",
  aiLikelihood?: AILikelihoodRecord,
  userId?: number
): Promise<RewriteEntry> {
  const row = await prisma.rewrite.create({
    data: {
      original,
      rewritten,
      style,
      language,
      aiLikelihoodOriginal: aiLikelihood?.original ?? null,
      aiLikelihoodHumanized: aiLikelihood?.humanized ?? null,
      aiLikelihoodDifference: aiLikelihood?.difference ?? null,
      userId: userId ?? null,
    },
  });
  return toRewriteEntry(row);
}

export async function getAllRewrites(userId?: number): Promise<RewriteEntry[]> {
  const rows = await prisma.rewrite.findMany({
    where: userId ? { userId } : {},
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRewriteEntry);
}

export async function deleteRewrite(id: number, userId?: number): Promise<boolean> {
  try {
    await prisma.rewrite.delete({ where: { id, ...(userId ? { userId } : {}) } });
    return true;
  } catch {
    return false;
  }
}

function toRewriteEntry(row: {
  id: number;
  original: string;
  rewritten: string;
  style: string;
  language: string;
  createdAt: Date;
  aiLikelihoodOriginal: number | null;
  aiLikelihoodHumanized: number | null;
  aiLikelihoodDifference: number | null;
}): RewriteEntry {
  return {
    id: row.id,
    original: row.original,
    rewritten: row.rewritten,
    style: row.style as RewriteEntry["style"],
    language: row.language as RewriteEntry["language"],
    created_at: row.createdAt.toISOString(),
    ai_likelihood_original: row.aiLikelihoodOriginal,
    ai_likelihood_humanized: row.aiLikelihoodHumanized,
    ai_likelihood_difference: row.aiLikelihoodDifference,
  };
}

// --- Feedback ---

export async function insertFeedback(
  rewriteId: number,
  rating: string
): Promise<Feedback> {
  await prisma.feedback.deleteMany({ where: { rewriteId } });
  const row = await prisma.feedback.create({
    data: { rewriteId, rating },
  });
  return {
    id: row.id,
    rewrite_id: row.rewriteId,
    rating: row.rating as Feedback["rating"],
    created_at: row.createdAt.toISOString(),
  };
}

export async function getFeedback(
  rewriteId: number
): Promise<Feedback | undefined> {
  const row = await prisma.feedback.findFirst({ where: { rewriteId } });
  if (!row) return undefined;
  return {
    id: row.id,
    rewrite_id: row.rewriteId,
    rating: row.rating as Feedback["rating"],
    created_at: row.createdAt.toISOString(),
  };
}

export async function getPositiveFeedbackExamples(
  style: string,
  limit: number = 3
): Promise<RewriteEntry[]> {
  const rows = await prisma.feedback.findMany({
    where: { rating: "positive", rewrite: { style } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { rewrite: true },
  });
  return rows.map((r) => toRewriteEntry(r.rewrite));
}

// --- Writing Profiles ---

export async function insertProfile(
  name: string,
  description: string,
  tone: string,
  formality: number,
  customInstructions: string,
  userId?: number
): Promise<WritingProfile> {
  const row = await prisma.writingProfile.create({
    data: { name, description, tone, formality, customInstructions, userId: userId ?? null },
  });
  return toProfile(row);
}

export async function getAllProfiles(userId?: number): Promise<WritingProfile[]> {
  const rows = await prisma.writingProfile.findMany({
    where: userId ? { userId } : {},
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toProfile);
}

export async function getProfile(
  id: number
): Promise<WritingProfile | undefined> {
  const row = await prisma.writingProfile.findUnique({ where: { id } });
  if (!row) return undefined;
  return toProfile(row);
}

export async function deleteProfile(id: number, userId?: number): Promise<boolean> {
  try {
    await prisma.writingProfile.delete({ where: { id, ...(userId ? { userId } : {}) } });
    return true;
  } catch {
    return false;
  }
}

function toProfile(row: {
  id: number;
  name: string;
  description: string;
  tone: string;
  formality: number;
  customInstructions: string;
  createdAt: Date;
}): WritingProfile {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    tone: row.tone,
    formality: row.formality,
    custom_instructions: row.customInstructions,
    created_at: row.createdAt.toISOString(),
  };
}

// --- API Keys ---

export async function createApiKey(name: string, userId?: number): Promise<ApiKey> {
  const key = `hum_${crypto.randomBytes(24).toString("hex")}`;
  const row = await prisma.apiKey.create({ data: { key, name, userId: userId ?? null } });
  return toApiKey(row);
}

export async function getAllApiKeys(userId?: number): Promise<ApiKey[]> {
  const rows = await prisma.apiKey.findMany({
    where: userId ? { userId } : {},
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toApiKey);
}

export async function validateApiKey(
  key: string
): Promise<ApiKey | undefined> {
  const row = await prisma.apiKey.findUnique({ where: { key } });
  if (!row) return undefined;
  await prisma.apiKey.update({
    where: { id: row.id },
    data: { lastUsed: new Date() },
  });
  return toApiKey(row);
}

export async function deleteApiKey(id: number, userId?: number): Promise<boolean> {
  try {
    await prisma.apiKey.delete({ where: { id, ...(userId ? { userId } : {}) } });
    return true;
  } catch {
    return false;
  }
}

function toApiKey(row: {
  id: number;
  key: string;
  name: string;
  createdAt: Date;
  lastUsed: Date | null;
}): ApiKey {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    created_at: row.createdAt.toISOString(),
    last_used: row.lastUsed?.toISOString() ?? null,
  };
}

// --- Metrics ---

export interface MetricEntry {
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  inputChars?: number;
  outputChars?: number;
  style?: string;
  language?: string;
  error?: string;
}

export async function recordMetric(metric: MetricEntry): Promise<void> {
  await prisma.metric.create({
    data: {
      endpoint: metric.endpoint,
      method: metric.method,
      statusCode: metric.statusCode,
      durationMs: metric.durationMs,
      inputChars: metric.inputChars ?? null,
      outputChars: metric.outputChars ?? null,
      style: metric.style ?? null,
      language: metric.language ?? null,
      error: metric.error ?? null,
    },
  });
}

export interface MetricsSummary {
  totalRequests: number;
  totalRewrites: number;
  avgRewriteDurationMs: number;
  errorRate: number;
  styleBreakdown: { style: string; count: number }[];
  languageBreakdown: { language: string; count: number }[];
  recentErrors: { endpoint: string; error: string; created_at: string }[];
}

export async function getMetricsSummary(): Promise<MetricsSummary> {
  const [
    totalRequests,
    totalRewrites,
    avgResult,
    errorCount,
    styleGroups,
    languageGroups,
    recentErrorRows,
  ] = await Promise.all([
    prisma.metric.count(),
    prisma.metric.count({ where: { endpoint: "/api/rewrite" } }),
    prisma.metric.aggregate({
      where: { endpoint: "/api/rewrite", statusCode: 200 },
      _avg: { durationMs: true },
    }),
    prisma.metric.count({ where: { statusCode: { gte: 400 } } }),
    prisma.metric.groupBy({
      by: ["style"],
      where: { style: { not: null } },
      _count: true,
      orderBy: { _count: { style: "desc" } },
    }),
    prisma.metric.groupBy({
      by: ["language"],
      where: { language: { not: null } },
      _count: true,
      orderBy: { _count: { language: "desc" } },
    }),
    prisma.metric.findMany({
      where: { statusCode: { gte: 400 } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { endpoint: true, error: true, createdAt: true },
    }),
  ]);

  return {
    totalRequests,
    totalRewrites,
    avgRewriteDurationMs: Math.round(avgResult._avg.durationMs ?? 0),
    errorRate:
      totalRequests > 0
        ? Math.round((errorCount / totalRequests) * 10000) / 100
        : 0,
    styleBreakdown: styleGroups.map((g) => ({
      style: g.style!,
      count: g._count,
    })),
    languageBreakdown: languageGroups.map((g) => ({
      language: g.language!,
      count: g._count,
    })),
    recentErrors: recentErrorRows.map((r) => ({
      endpoint: r.endpoint,
      error: r.error ?? "",
      created_at: r.createdAt.toISOString(),
    })),
  };
}
