import { NextResponse } from "next/server";
import { getAllRewrites } from "@/lib/db";

export async function GET() {
  try {
    const history = await getAllRewrites();
    return NextResponse.json({ history });
  } catch (error) {
    console.error("History fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
