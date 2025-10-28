import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import createServerSupabase from "@/lib/supabase/server";

const BodySchema = z.object({
  price: z.number().nonnegative(),
  currency: z.string().min(2).max(3).optional().default("SAR"),
  sale_price: z.number().nonnegative().nullable().optional(),
  ends_at: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ variantId: string }> }
) {
  const { variantId } = await context.params;
  const body = BodySchema.parse(await req.json());

  const supabase = await createServerSupabase();

  // أغلق السعر النشط (إن وجد)
  const { data: current } = await supabase
    .from("variant_prices")
    .select("id")
    .eq("variant_id", variantId)
    .is("ends_at", null)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (current?.id) {
    const { error: uErr } = await supabase
      .from("variant_prices")
      .update({ ends_at: new Date().toISOString() })
      .eq("id", current.id);
    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 400 });
    }
  }

  // أضف سعرًا جديدًا
  const { error: insErr } = await supabase.from("variant_prices").insert({
    variant_id: variantId,
    price: body.price,
    currency: body.currency ?? "SAR",
    sale_price: body.sale_price ?? null,
    starts_at: new Date().toISOString(),
    ends_at: body.ends_at ?? null,
    price_type: "retail",
  });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
