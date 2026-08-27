import { NextRequest, NextResponse } from "next/server";
import { insertProfile, getAllProfiles, deleteProfile } from "@/lib/db";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromHeaders(request.headers);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profiles = await getAllProfiles(user.userId);
    return NextResponse.json({ profiles });
  } catch (error) {
    console.error("Profiles fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromHeaders(request.headers);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, description, tone, formality, customInstructions } = await request.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const profile = await insertProfile(
      name.trim(),
      description?.trim() || "",
      tone?.trim() || "neutral",
      typeof formality === "number" ? Math.min(100, Math.max(0, formality)) : 50,
      customInstructions?.trim() || "",
      user.userId
    );

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    console.error("Profile create error:", error);
    return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = getUserFromHeaders(request.headers);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const deleted = await deleteProfile(Number(id), user.userId);
  if (!deleted) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
