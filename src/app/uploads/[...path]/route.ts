import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

function resolveUploadPath(rawPathSegments: string[]) {
  try {
    const decodedSegments = rawPathSegments.map((segment) =>
      decodeURIComponent(segment)
    );
    const fullPath = path.resolve(UPLOADS_ROOT, ...decodedSegments);
    const relativePath = path.relative(UPLOADS_ROOT, fullPath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      return null;
    }

    return fullPath;
  } catch {
    return null;
  }
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const fullPath = resolveUploadPath((await params).path);

  if (!fullPath)
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  try {
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const file = await fs.readFile(fullPath);

    return new NextResponse(file, {
      headers: {
        "Content-Type": "image/webp",
        // Upload URLs are content-addressed (member image keys are random
        // UUIDs, news image ids change on replace), so a stored file never
        // changes — cache it aggressively.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}
