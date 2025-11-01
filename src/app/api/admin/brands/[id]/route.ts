// src/app/api/admin/brands/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import createClient, { createServiceRoleSupabase } from "@/lib/supabase/server";
import { z } from "zod";

function assertAdmin(req: NextRequest) {
  const role = req.headers.get("x-app-role") ?? "";
  if (process.env.NODE_ENV !== "production") {
    if (role === "admin" || role === "") return null;
  }
  if (role !== "admin") {
    return NextResponse.json({ message: "Forbidden (missing x-app-role=admin)" }, { status: 403 });
  }
  return null;
}

const UrlOrPath = z
  .string()
  .refine(
    (v) => v === undefined || v === null || v === "" || v.startsWith("http") || v.startsWith("/"),
    "Invalid URL"
  );

const SeoSchema = z.object({
  slug: z.string().min(1).optional(),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
  is_active: z.boolean().optional(),
});

const UpdateBrandSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().optional(),
  ar_char: z.string().optional(),
  en_char: z.string().optional(),
  logo: UrlOrPath.nullable().optional(),
  banner: UrlOrPath.nullable().optional(),
  is_active: z.boolean().optional(),
  seo: z.preprocess((v) => {
    const o = v as any;
    if (!o || !o.slug || String(o.slug).trim() === "") return undefined;
    return o;
  }, SeoSchema).optional(),
});

/** GET /api/admin/brands/[id] */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("brands").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ message: "Not found", error }, { status: 404 });
  return NextResponse.json({ data });
}

/** PATCH /api/admin/brands/[id] */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = assertAdmin(req);
  if (guard) return guard;

  const { id } = await ctx.params;
  const supabase = await createClient();             // للقراءة
  const admin = createServiceRoleSupabase();         // للكتابة

  const body = await req.json();
  const parsed = UpdateBrandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 422 }
    );
  }
  const payload = parsed.data;

  const update: any = {};
  for (const k of ["name", "description", "ar_char", "en_char", "logo", "banner", "is_active"] as const) {
    if (k in payload) update[k] = (payload as any)[k];
  }
  if (Object.keys(update).length) {
    const { error: upErr } = await admin.from("brands").update(update).eq("id", id);
    if (upErr) return NextResponse.json({ message: "Update failed", error: upErr }, { status: 500 });
  }

  if (payload.seo) {
    const seo: any = { entity_type: "brand", entity_id: id, lang: "ar" };
    if (payload.seo.slug !== undefined) seo.slug = payload.seo.slug;
    if (payload.seo.meta_title !== undefined) seo.meta_title = payload.seo.meta_title;
    if (payload.seo.meta_description !== undefined) seo.meta_description = payload.seo.meta_description;
    if (payload.seo.is_active !== undefined) seo.is_active = payload.seo.is_active;

    const { error: seoErr } = await admin
      .from("seo_pages")
      .upsert(seo, { onConflict: "entity_type,entity_id,lang" });

    if (seoErr) {
      return NextResponse.json(
        { message: "Brand updated but SEO failed", seo_error: seoErr },
        { status: 207 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/brands/[id]?force=true */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = assertAdmin(req);
  if (guard) return guard;

  const { id } = await ctx.params;
  const supabase = await createClient();             // للقراءة
  const admin = createServiceRoleSupabase();         // للكتابة
  const force = new URL(req.url).searchParams.get("force") === "true";

  // احذف صفحة الـ SEO إن وجدت
  await admin.from("seo_pages").delete().match({ entity_type: "brand", entity_id: id });

  // حاول حذف الماركة
  let { error: delErr } = await admin.from("brands").delete().eq("id", id);

  // معالجة قيود FK (products.brand_id)
  if (delErr && (delErr as any).code === "23503") {
    if (!force) {
      return NextResponse.json(
        {
          message:
            "لا يمكن الحذف: الماركة مرتبطة بمنتجات. أعد المحاولة مع force=true أو عطّلها بدلًا من الحذف.",
          code: delErr.code,
        },
        { status: 409 }
      );
    }
    // force=true => فك الربط ثم احذف
    await admin.from("products").update({ brand_id: null }).eq("brand_id", id);
    ({ error: delErr } = await admin.from("brands").delete().eq("id", id));
  }

  if (delErr) {
    return NextResponse.json({ message: "Failed to delete brand", error: delErr }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
