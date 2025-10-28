// src/app/api/admin/uploads/brand-local/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-dynamic"; // نتأكد أنه Node وليس Edge

function sanitizeSlugish(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
}
function extOf(name: string) {
  const e = (name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  return e || "bin";
}
function guessContentType(ext: string) {
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    avif: "image/avif",
  };
  return map[ext] || "application/octet-stream";
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const keyPrefixRaw = String(form.get("keyPrefix") || "brand");
  const kind = (String(form.get("kind") || "file") as "logo" | "banner" | "file");

  if (!file) {
    return NextResponse.json({ message: "file is required" }, { status: 400 });
  }

  // المسار الهدف على القرص
  const keyPrefix = sanitizeSlugish(keyPrefixRaw) || "brand";
  const projRoot = process.cwd(); // C:\ShopYem\admin-console
  const baseDir = path.join(projRoot, "src", "image", "catalog", "brands", keyPrefix);

  // اسم الملف
  const ext = extOf(file.name);
  const fname = `${kind}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  const absPath = path.join(baseDir, fname);

  // اكتب الملف
  await fs.mkdir(baseDir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absPath, buf);

  // ارجع رابط عرض عبر راوت التقديم (ملف أدناه)
  const publicUrl = `/image/catalog/brands/${keyPrefix}/${fname}`;
  return NextResponse.json({
    ok: true,
    url: publicUrl,
    path: absPath.replaceAll("\\", "/"),
    contentType: guessContentType(ext),
  });
}
