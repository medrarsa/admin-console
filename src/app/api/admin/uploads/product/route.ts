// src/app/api/admin/uploads/product/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

const BUCKET = "products"; // تأكد البكت Public واسمه products

function extOf(name: string) {
  const e = (name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  return e || "bin";
}

// ⛳️ لا نكرر اسم البكت داخل المسار
function objPath(productId: string, fname: string) {
  return `${productId}/${fname}`;
}

const ok = (data: any, status = 200) =>
  NextResponse.json({ success: true, status, data }, { status });
const fail = (error: string, status = 400, meta?: any) =>
  NextResponse.json({ success: false, status, error, meta }, { status });

/**
 * POST /api/admin/uploads/product
 * FormData:
 * - productId: string (required)
 * - files: File[] (one or more)
 * - alts: string[] (optional, same order as files)
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const productId = String(form.get("productId") || "").trim();
    const files = form.getAll("files") as File[];
    const alts = form.getAll("alts").map((v) => String(v));

    if (!productId) return fail("productId is required", 400);
    if (!files?.length) return fail("no files[] provided", 400);

    const admin = createServiceRoleSupabase();

    const uploaded: Array<{ url: string; alt: string | null }> = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = extOf(f.name);
      const fname = `gallery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const path = objPath(productId, fname);

      const buf = Buffer.from(await f.arrayBuffer());
      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(path, buf, { upsert: true, contentType: f.type || "application/octet-stream" });
      if (upErr) return fail(upErr.message, 500, { where: "storage/upload" });

      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
      uploaded.push({ url: pub.publicUrl, alt: alts[i] ? alts[i] : null });
    }

    return ok({ files: uploaded }, 201);
  } catch (e: any) {
    return fail(e?.message || "upload failed", 500);
  }
}
