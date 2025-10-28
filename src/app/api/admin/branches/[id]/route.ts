import { NextRequest, NextResponse } from "next/server";
import createClient from "@/lib/supabase/server";
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

const UpdateBrandSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().optional(),
  ar_char: z.string().optional(),
  en_char: z.string().optional(),
  logo: z.string().url().nullable().optional(),
  banner: z.string().url().nullable().optional(),
  is_active: z.boolean().optional(),
  seo: z.object({
    slug: z.string().min(1).max(200).optional(),
    meta_title: z.string().optional(),
    meta_description: z.string().optional(),
    is_active: z.boolean().optional(),
  }).optional(),
});

/**
 * Next.js 15: context.params هي Promise
 * لذلك لازم ننتظرها قبل استخدام id.
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = assertAdmin(req);
  if (guard) return guard;

  const supabase = await createClient();
  const { id } = await context.params;

  const body = await req.json();
  const parsed = UpdateBrandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 422 }
    );
  }
  const payload = parsed.data;

  // نبني كائن التحديث بدون استخدام any
  const update: Record<string, unknown> = {};
  for (const k of ["name","description","ar_char","en_char","logo","banner","is_active"] as const) {
    if (k in payload) update[k] = (payload as Record<string, unknown>)[k];
  }

  if (Object.keys(update).length) {
    const { error: upErr } = await supabase.from("brands").update(update).eq("id", id);
    if (upErr) return NextResponse.json({ message: "Update failed", error: upErr }, { status: 500 });
  }

  if (payload.seo) {
    const seo: Record<string, unknown> = { entity_type: "brand", entity_id: id, lang: "ar" };
    if (payload.seo.slug !== undefined) seo.slug = payload.seo.slug;
    if (payload.seo.meta_title !== undefined) seo.meta_title = payload.seo.meta_title;
    if (payload.seo.meta_description !== undefined) seo.meta_description = payload.seo.meta_description;
    if (payload.seo.is_active !== undefined) seo.is_active = payload.seo.is_active;

    const { error: seoErr } = await supabase
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

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = assertAdmin(req);
  if (guard) return guard;

  const supabase = await createClient();
  const { id } = await context.params;

  const { error: seoDelErr } = await supabase
    .from("seo_pages")
    .delete()
    .match({ entity_type: "brand", entity_id: id });
  if (seoDelErr) {
    return NextResponse.json({ message: "Failed to delete SEO page", error: seoDelErr }, { status: 500 });
  }

  const { error: delErr } = await supabase.from("brands").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ message: "Failed to delete brand", error: delErr }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
