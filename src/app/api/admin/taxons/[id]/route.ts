// src/app/api/admin/taxons/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["active", "hidden"]).optional(),
  hide_products: z.boolean().optional(),
  image: z.string().min(1).nullable().optional(),
  image_alt: z.string().min(1).nullable().optional(), // ← جديد
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient();
    const id = params.id;
    const payload = PatchSchema.parse(await req.json());

    const { data: taxon, error: exErr } = await supabase
      .from("taxons")
      .select("id")
      .eq("id", id)
      .is("archived_at", null)
      .single();

    if (exErr || !taxon) {
      return NextResponse.json(
        { error: "Taxon not found or archived" },
        { status: 404 }
      );
    }

    const updates: Record<string, any> = {};
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.hide_products !== undefined)
      updates.hide_products = payload.hide_products;
    if (payload.image !== undefined) updates.image = payload.image ?? null;
    if (payload.image_alt !== undefined)
      updates.image_alt = payload.image_alt ?? null;

    if (!Object.keys(updates).length) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    const { data, error } = await supabase
      .from("taxons")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Invalid payload" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerClient();
  const id = params.id;

  const { count: childrenCount } = await supabase
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

  const { count: productsCount } = await supabase
    .from("product_taxons")
    .select("*", { count: "exact", head: true })
    .eq("taxon_id", id);

  if ((productsCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "لا يمكن الأرشفة — مرتبط بمنتجات." },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from("taxons")
    .update({
      archived_at: new Date().toISOString(),
      status: "hidden",
      is_active: false,
    })
    .eq("id", id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
