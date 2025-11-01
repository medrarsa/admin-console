// src/app/api/admin/uploads/brand/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function sanitize(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
}
function extOf(name: string) {
  const e = (name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  return e || "bin";
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const keyPrefixRaw = String(form.get("keyPrefix") || "brand");
    const kind = (String(form.get("kind") || "file") as "logo" | "banner" | "file");

    if (!file) return NextResponse.json({ message: "file is required" }, { status: 400 });

    const admin = createServiceRoleSupabase(); // نستخدم Service-Role للرفع
    const keyPrefix = sanitize(keyPrefixRaw) || "brand";
    const ext = extOf(file.name);
    const fname = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const objectPath = `brands/${keyPrefix}/${fname}`;

    // حوّل File إلى ArrayBuffer → Buffer
    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);

    // ارفع إلى باكت عام
    const { error: upErr } = await admin.storage
      .from("brand-assets")
      .upload(objectPath, buf, {
        upsert: true,
        contentType: file.type || "application/octet-stream",
      });

    if (upErr) {
      return NextResponse.json({ message: "upload failed", error: upErr.message }, { status: 500 });
    }

    // استخرج الرابط العام
    const { data: pub } = admin.storage.from("brand-assets").getPublicUrl(objectPath);
    const publicUrl = pub.publicUrl; // رابط مباشر صالح للعرض

    return NextResponse.json({ ok: true, url: publicUrl });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || "unexpected error" }, { status: 500 });
  }
}
