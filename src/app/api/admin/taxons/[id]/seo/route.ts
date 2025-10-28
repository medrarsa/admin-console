import { NextRequest, NextResponse } from "next/server";
import createServerClient from "@/lib/supabase/server"

import { z } from "zod";

const SeoSchema = z.object({
  lang: z.string().default("ar"),
  slug: z.string().optional(),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
  meta_keywords: z.string().optional(),
  canonical_url: z.string().optional(),
  og_title: z.string().optional(),
  og_description: z.string().optional(),
  og_image_url: z.string().optional(),
  robots: z.string().optional(),
  schema_json: z.any().optional(),
  is_active: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("seo_pages")
    .select("*")
    .eq("entity_type", "taxon")
    .eq("entity_id", params.id)
    .eq("lang", "ar")
    .maybeSingle();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerClient();
  const taxonId = params.id;
  const body = SeoSchema.parse(await req.json());
  const lang = body.lang ?? "ar";

  // هل موجودة صفحة SEO مسبقًا؟
  const { data: existing } = await supabase
    .from("seo_pages")
    .select("id")
    .eq("entity_type", "taxon")
    .eq("entity_id", taxonId)
    .eq("lang", lang)
    .maybeSingle();

  const payload = {
    entity_type: "taxon",
    entity_id: taxonId,
    lang,
    slug: body.slug ?? null,
    meta_title: body.meta_title ?? null,
    meta_description: body.meta_description ?? null,
    meta_keywords: body.meta_keywords ?? null,
    canonical_url: body.canonical_url ?? null,
    og_title: body.og_title ?? null,
    og_description: body.og_description ?? null,
    og_image_url: body.og_image_url ?? null,
    robots: body.robots ?? "index,follow",
    schema_json: body.schema_json ?? null,
    is_active: body.is_active ?? true,
  };

  if (existing?.id) {
    const { data, error } = await supabase
      .from("seo_pages")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, data });
  } else {
    const { data, error } = await supabase
      .from("seo_pages")
      .insert(payload)
      .select()
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, data });
  }
}
