import { NextRequest, NextResponse } from "next/server";
import { createApiKey, getAllApiKeys, deleteApiKey } from "@/lib/db";

export async function GET() {
  try {
    const keys = (await getAllApiKeys()).map((k) => ({
      ...k,
      key: k.key.slice(0, 8) + "..." + k.key.slice(-4),
    }));
    return NextResponse.json({ keys });
  } catch (error) {
    console.error("Keys fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch keys" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const apiKey = await createApiKey(name.trim());
    return NextResponse.json(apiKey, { status: 201 });
  } catch (error) {
    console.error("Key create error:", error);
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const deleted = await deleteApiKey(Number(id));
  if (!deleted) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
