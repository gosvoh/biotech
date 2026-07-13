import { NextResponse } from "next/server";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { revalidate } from "@/lib/utils.server";

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get("x-revalidate-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  revalidate([...CACHE_TAGS]);
  return NextResponse.json({ revalidated: CACHE_TAGS });
}
