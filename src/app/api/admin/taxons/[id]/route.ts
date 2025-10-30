// src/app/api/admin/taxons/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSb } from "@supabase/supabase-js";
import { z } from "zod";

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing SUPABASE service env");
  return createSb(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["active", "hidden"]).optional(),
  hide_products: z.boolean().optional(),
  image: z.string().min(1).nullable().optional(),
  image_alt: z.string().min(1).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supa = createServiceClient();
    const { id } = await context.params;
    const payload = PatchSchema.parse(await req.json());

    // نتأكد أن التصنيف موجود (بدون تقييد RLS الآن)
    const { data: taxon, error: exErr } = await supa
      .from("taxons")
      .select("id, archived_at")
      .eq("id", id)
      .maybeSingle();

    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 400 });
    if (!taxon || taxon.archived_at) {
      return NextResponse.json({ error: "Taxon not found or archived" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.hide_products !== undefined) updates.hide_products = payload.hide_products;
    if (payload.image !== undefined) updates.image = payload.image ?? null;
    if (payload.image_alt !== undefined) updates.image_alt = payload.image_alt ?? null;

    if (!Object.keys(updates).length) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    const { data, error } = await supa
      .from("taxons")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid payload" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supa = createServiceClient();
  const { id } = await context.params;

  // فحوصات الأبناء والمنتجات كما كانت (لكن عبر Service Role)
  const { count: childrenCount } = await supa
    .from("taxons")
    .select("*", { count: "exact", head: true })
    .eq("parent_id", id)
    .is("archived_at", null);

  if ((childrenCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "لا يمكن الأرشفة — لهذا التصنيف أبناء." },
      { status: 409 }
    );
  }

  const { count: productsCount } = await supa
    .from("product_taxons")
    .select("*", { count: "exact", head: true })
    .eq("taxon_id", id);

  if ((productsCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "لا يمكن الأرشفة — مرتبط بمنتجات." },
      { status: 409 }
    );
  }

  const { error } = await supa
    .from("taxons")
    .update({
      archived_at: new Date().toISOString(),
      status: "hidden",
      is_active: false,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
