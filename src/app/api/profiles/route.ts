import { NextRequest, NextResponse } from "next/server";
import { insertProfile, getAllProfiles, deleteProfile } from "@/lib/db";

export async function GET() {
  try {
    const profiles = await getAllProfiles();
    return NextResponse.json({ profiles });
  } catch (error) {
    console.error("Profiles fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, description, tone, formality, customInstructions } = await request.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const profile = await insertProfile(
      name.trim(),
      description?.trim() || "",
      tone?.trim() || "neutral",
      typeof formality === "number" ? Math.min(100, Math.max(0, formality)) : 50,
      customInstructions?.trim() || ""
    );

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    console.error("Profile create error:", error);
    return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const deleted = await deleteProfile(Number(id));
  if (!deleted) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
