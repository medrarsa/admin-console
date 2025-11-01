// src/app/api/admin/products/[id]/images/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import createServerSupabase, { createServiceRoleSupabase } from "@/lib/supabase/server";

const BUCKET = "products"; // تأكد أن الباكت موجود ومفعل Public

function extOf(name: string) {
  const e = (name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  return e || "bin";
}
function storagePath(productId: string, fname: string) {
  // لا نكرر اسم البكت داخل المسار
  return `${productId}/${fname}`;
}
const ok = (data: any, status = 200) => NextResponse.json({ success: true, status, data }, { status });
const fail = (error: string, status = 400, meta?: any) =>
  NextResponse.json({ success: false, status, error, meta }, { status });

/** GET: قائمة صور المنتج */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supa = await createServerSupabase();
    const { id: product_id } = await ctx.params;

    const { data, error } = await supa
      .from("product_images")
      .select("id,url,alt,is_primary,sort_order,type,video_url,three_d_image_url")
      .eq("product_id", product_id)
      .order("sort_order", { ascending: true });
    if (error) return fail(error.message, 500, { where: "select/product_images" });

    return ok(data ?? []);
  } catch (e: any) {
    return fail(e?.message || "fetch images failed", 500);
  }
}

/** POST: رفع صور متعددة وتعيين أول صورة أساسية إن لم توجد أساسية */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: product_id } = await ctx.params;
    const supa = await createServerSupabase(); // read
    const admin = createServiceRoleSupabase(); // write + storage

    // تأكد وجود المنتج
    const { data: p, error: e0 } = await supa.from("products").select("id").eq("id", product_id).maybeSingle();
    if (e0) return fail(e0.message, 400, { where: "exists/products" });
    if (!p?.id) return fail("المنتج غير موجود", 404);

    const form = await req.formData();
    const files = form.getAll("files") as File[];
    const alts = form.getAll("alts").map((v) => String(v));
    if (!files?.length) return fail("no files[] provided", 400);

    // تحقّق آمن من وجود أساسية حالياً
    let hasPrimary = false;
    {
      const { data: curP, error: eP } = await supa
        .from("product_images")
        .select("id")
        .eq("product_id", product_id)
        .eq("is_primary", true)
        .limit(1)
        .maybeSingle();
      hasPrimary = !!(curP && curP.id && !eP);
    }

    // آخر sort_order
    const { data: curMax } = await supa
      .from("product_images")
      .select("sort_order")
      .eq("product_id", product_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    let order = (curMax?.sort_order ?? -1) + 1;

    const rows: any[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = extOf(f.name);
      const fname = `gallery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const path = storagePath(product_id, fname);

      const buf = Buffer.from(await f.arrayBuffer());
      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(path, buf, { upsert: true, contentType: f.type || "application/octet-stream" });
      if (upErr) return fail(upErr.message, 500, { where: "storage/upload" });

      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);

      rows.push({
        product_id,
        url: pub.publicUrl,
        alt: alts[i] ? alts[i] : null,
        // ✅ عيّن الأساسية فقط إذا تأكدنا عدم وجود أساسية مسبقًا
        is_primary: !hasPrimary && i === 0,
        sort_order: order++,
        type: "image",
        video_url: null,
        three_d_image_url: null,
      });
    }

    // الإدراج
    const { data: inserted, error: insErr } = await admin
      .from("product_images")
      .insert(rows)
      .select("id,url,alt,is_primary,sort_order,type");
    if (insErr) return fail(insErr.message, 500, { where: "insert/product_images" });

    return ok(inserted, 201);
  } catch (e: any) {
    return fail(e?.message || "upload images failed", 500);
  }
}

/** PATCH: تعيين أساسية + ترتيب */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: product_id } = await ctx.params;
    const admin = createServiceRoleSupabase();

    const body = (await req.json()) as { primaryId?: string; order?: string[] };

    if (body.primaryId) {
      await admin.from("product_images").update({ is_primary: false }).eq("product_id", product_id);
      await admin.from("product_images").update({ is_primary: true }).eq("id", body.primaryId);
    }

    if (Array.isArray(body.order)) {
      for (let i = 0; i < body.order.length; i++) {
        await admin.from("product_images").update({ sort_order: i }).eq("id", body.order[i]);
      }
    }

    return ok({ done: true });
  } catch (e: any) {
    return fail(e?.message || "patch images failed", 500);
  }
}

/** DELETE: حذف صورة (DB + Storage) */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: product_id } = await ctx.params;
    const admin = createServiceRoleSupabase();
    const body = (await req.json()) as { id: string; url?: string };

    const { error: dErr } = await admin.from("product_images").delete().eq("id", body.id).eq("product_id", product_id);
    if (dErr) return fail(dErr.message, 500, { where: "delete/product_images" });

    if (body.url) {
      try {
        const u = new URL(body.url);
        const idx = u.pathname.indexOf("/object/public/");
        if (idx >= 0) {
          const relative = u.pathname.slice(idx + "/object/public/".length); // "<bucket>/<path>"
          const [bucket, ...rest] = relative.split("/");
          if (bucket === BUCKET && rest.length) {
            await admin.storage.from(BUCKET).remove([rest.join("/")]);
          }
        }
      } catch {}
    }

    return ok({ id: body.id });
  } catch (e: any) {
    return fail(e?.message || "delete image failed", 500);
  }
}
