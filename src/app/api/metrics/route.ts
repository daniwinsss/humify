import { NextRequest, NextResponse } from "next/server";
import { getMetricsSummary } from "@/lib/db";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = getUserFromHeaders(request.headers);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await getMetricsSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Metrics error:", error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}
