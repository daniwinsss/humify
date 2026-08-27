import { NextRequest, NextResponse } from "next/server";
import { getAllRewrites } from "@/lib/db";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromHeaders(request.headers);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const history = await getAllRewrites(user.userId);
    return NextResponse.json({ history });
  } catch (error) {
    console.error("History fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
