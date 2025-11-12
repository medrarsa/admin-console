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
    const brandSlugRaw = String(form.get("keyPrefix") || "brand"); // ex: "puma"
    const kind = (String(form.get("kind") || "file") as "logo" | "banner" | "file");

    if (!file) {
      return NextResponse.json({ message: "file is required" }, { status: 400 });
    }

    // Service-Role client (RLS-safe for server-side uploads)
    const admin = createServiceRoleSupabase();

    // ✅ bucket name as it appears in Supabase
    const BUCKET = "brands";

    // Folder = <slug>  (don't repeat the bucket name inside the path)
    const brandSlug = sanitize(brandSlugRaw) || "brand";
    const ext = extOf(file.name);
    const fname = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const objectPath = `${brandSlug}/${fname}`; // e.g. puma/logo-*.png

    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(objectPath, buf, {
        upsert: true,
        contentType: file.type || "application/octet-stream",
      });

    if (upErr) {
      return NextResponse.json(
        { message: "upload failed", error: upErr.message },
        { status: 500 }
      );
    }

    // Public URL (Supabase CDN)
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(objectPath);
    return NextResponse.json({ ok: true, url: pub.publicUrl });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message || "unexpected error" },
      { status: 500 }
    );
  }
}
