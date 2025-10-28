// src/app/api/admin/taxons/[id]/image/route.ts
// يحفظ صور التصنيفات على القرص: /public/image/catalog
// URL النهائي: /image/catalog/<filename>
// يدعم: POST (رفع/استبدال), PATCH (تحديث ALT), DELETE (حذف)

import { NextRequest, NextResponse } from "next/server";
import createServerClient from "@/lib/supabase/server"

import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureTaxonExists(supabase: any, id: string) {
  const { data } = await supabase
    .from("taxons")
    .select("id,image")
    .eq("id", id)
    .is("archived_at", null)
    .single();
  return data as { id: string; image: string | null } | null;
}
function getPublicDir() {
  return path.join(process.cwd(), "public", "image", "catalog");
}
function safeExt(mime?: string, fallback = ".jpg") {
  if (!mime) return fallback;
  const m = mime.toLowerCase();
  if (m.includes("png")) return ".png";
  if (m.includes("webp")) return ".webp";
  if (m.includes("gif")) return ".gif";
  if (m.includes("svg")) return ".svg";
  if (m.includes("jpeg") || m.includes("jpg")) return ".jpg";
  return fallback;
}
async function unlinkIfExists(absPath: string) {
  try {
    await fs.unlink(absPath);
  } catch {}
}
function absPathFromPublicUrl(publicUrl: string) {
  // publicUrl مثل: /image/catalog/xxx.png
  const file = publicUrl.split("/").pop()!;
  return path.join(getPublicDir(), file);
}

/** POST: رفع/استبدال الصورة + تحديث image_alt */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient();
    const taxonId = params.id;
    const found = await ensureTaxonExists(supabase, taxonId);
    if (!found)
      return NextResponse.json(
        { error: "Taxon not found or archived" },
        { status: 404 }
      );

    const form = await req.formData();
    const file = form.get("file");
    const alt = (form.get("alt") as string) || null;
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Expected multipart/form-data with 'file' field." },
        { status: 400 }
      );
    }

    const ext = path.extname(file.name || "") || safeExt(file.type);
    const name = `${taxonId}-${randomUUID()}${ext}`;
    const pubDir = getPublicDir();
    await fs.mkdir(pubDir, { recursive: true });

    // اكتب الملف
    const buf = Buffer.from(await file.arrayBuffer());
    const absPath = path.join(pubDir, name);
    await fs.writeFile(absPath, buf, { flag: "wx" });

    const publicUrl = `/image/catalog/${name}`;

    // احذف القديمة لو موجودة
    if (found.image) await unlinkIfExists(absPathFromPublicUrl(found.image));

    // حدّث السجل
    const { data, error } = await supabase
      .from("taxons")
      .update({ image: publicUrl, image_alt: alt })
      .eq("id", taxonId)
      .select()
      .single();

    if (error) {
      await unlinkIfExists(absPath);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, url: publicUrl, data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Upload failed" },
      { status: 400 }
    );
  }
}

/** PATCH: تحديث ALT فقط */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerClient();
  const taxonId = params.id;
  const { alt } = (await req.json()) as { alt?: string | null };
  const exists = await ensureTaxonExists(supabase, taxonId);
  if (!exists)
    return NextResponse.json(
      { error: "Taxon not found or archived" },
      { status: 404 }
    );

  const { data, error } = await supabase
    .from("taxons")
    .update({ image_alt: alt ?? null })
    .eq("id", taxonId)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

/** DELETE: حذف الصورة من القرص وتفريغ الحقول */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerClient();
  const taxonId = params.id;
  const found = await ensureTaxonExists(supabase, taxonId);
  if (!found)
    return NextResponse.json(
      { error: "Taxon not found or archived" },
      { status: 404 }
    );

  if (found.image) {
    await unlinkIfExists(absPathFromPublicUrl(found.image));
  }

  const { error } = await supabase
    .from("taxons")
    .update({ image: null, image_alt: null })
    .eq("id", taxonId);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
