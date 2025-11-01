// src/app/image/catalog/[...path]/route.ts
// ❗ الأفضل حذف الملف بالكامل. إن أردت إبقاءه، غيّر المسار إلى public:
import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function contentType(filePath: string) {
  const ext = (filePath.split(".").pop() || "").toLowerCase();
  const map: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", avif: "image/avif",
  };
  return map[ext] || "application/octet-stream";
}

export async function GET(_req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path: p } = await context.params;

  // ✅ اقرأ من public
  const absolutePath = path.join(
    process.cwd(),
    "public",
    "image",
    "catalog",
    "brands",
    ...p.map(decodeURIComponent)
  );

  try {
    const buf = await fs.readFile(absolutePath);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": contentType(absolutePath),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
