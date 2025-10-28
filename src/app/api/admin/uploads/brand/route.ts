import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function sanitize(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
}
function extOf(name: string) {
  const e = (name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  return e || "bin";
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const keyPrefixRaw = String(form.get("keyPrefix") || "brand");
  const kind = (String(form.get("kind") || "file") as "logo" | "banner" | "file");

  if (!file) return NextResponse.json({ message: "file is required" }, { status: 400 });

  const keyPrefix = sanitize(keyPrefixRaw) || "brand";

  // 👇 نحفظ داخل public (مش src)
  const baseDir = path.join(process.cwd(), "public", "image", "catalog", "brands", keyPrefix);
  await fs.mkdir(baseDir, { recursive: true });

  const ext = extOf(file.name);
  const fname = `${kind}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  const absPath = path.join(baseDir, fname);

  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absPath, buf);

  // رابط جاهز للعرض فورًا
  const publicUrl = `/image/catalog/brands/${keyPrefix}/${fname}`;
  return NextResponse.json({ ok: true, url: publicUrl });
}
