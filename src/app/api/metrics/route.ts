import { NextResponse } from "next/server";
import { getMetricsSummary } from "@/lib/db";

export async function GET() {
  try {
    const summary = await getMetricsSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Metrics error:", error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}
