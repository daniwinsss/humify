import { NextRequest, NextResponse } from "next/server";
import { insertFeedback, getFeedback } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { rewriteId, rating } = await request.json();

    if (!rewriteId || typeof rewriteId !== "number") {
      return NextResponse.json({ error: "rewriteId is required" }, { status: 400 });
    }

    if (!rating || !["positive", "negative"].includes(rating)) {
      return NextResponse.json(
        { error: "rating must be 'positive' or 'negative'" },
        { status: 400 }
      );
    }

    const feedback = await insertFeedback(rewriteId, rating);
    return NextResponse.json(feedback);
  } catch (error) {
    console.error("Feedback error:", error);
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const rewriteId = request.nextUrl.searchParams.get("rewriteId");
  if (!rewriteId) {
    return NextResponse.json({ error: "rewriteId required" }, { status: 400 });
  }

  const feedback = await getFeedback(Number(rewriteId));
  return NextResponse.json({ feedback: feedback || null });
}
