import { type NextRequest, NextResponse } from "next/server";
import fs from "fs";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const url = decodeURIComponent((await params).path.join("/"));
  console.error("PARAMS", url);

  if (!fs.existsSync(`./uploads/${url}`))
    return NextResponse.json({ error: "Image not found" }, { status: 404 });

  return new NextResponse(fs.readFileSync(`./uploads/${url}`), {
    headers: {
      "Content-Type": "image/webp",
    },
  });
}
