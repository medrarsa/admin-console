// src/app/api/admin/inventory/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import createServerSupabase from "@/lib/supabase/server";

const TxSchema = z.object({
  variant_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  kind: z.enum(["in", "out", "adjust", "return"]),
  qty: z.number().int().positive(), // للموازنة: adjust نستخدم + أو - عبر kind='adjust' مع qty موجبة فقط؟
  reference: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const body = await req.json();
    const payload = TxSchema.parse(body);

    // تحقق وجود صف مخزون للزوج (variant, branch) — إن لم يوجد أنشئه 0
    const { data: inv } = await supabase
      .from("variant_inventory")
      .select("id")
      .eq("variant_id", payload.variant_id)
      .eq("branch_id", payload.branch_id)
      .maybeSingle();

    if (!inv) {
      const { error: mkErr } = await supabase.from("variant_inventory").insert({
        variant_id: payload.variant_id,
        branch_id: payload.branch_id,
        qty_on_hand: 0,
        qty_reserved: 0,
      });
      if (mkErr)
        return NextResponse.json({ error: mkErr.message }, { status: 400 });
    }

    // إدراج المعاملة (التريغر سيعدل الكميات)
    const { error: txErr } = await supabase
      .from("variant_inventory_transactions")
      .insert({
        variant_id: payload.variant_id,
        branch_id: payload.branch_id,
        kind: payload.kind,
        qty: payload.qty,
        reference: payload.reference ?? null,
      });
    if (txErr)
      return NextResponse.json({ error: txErr.message }, { status: 400 });

    // رجّع آخر قيم للمخزون بعد التحديث
    const { data: after } = await supabase
      .from("variant_inventory")
      .select("qty_on_hand, qty_reserved")
      .eq("variant_id", payload.variant_id)
      .eq("branch_id", payload.branch_id)
      .single();

    return NextResponse.json({ success: true, data: after }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
