// src/app/api/admin/products/[id]/options/value/[valueId]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; valueId: string }> }
) {
  const { id: productId, valueId } = await ctx.params;
  if (!productId || !valueId) {
    return NextResponse.json(
      { success: false, message: "Missing productId/valueId" },
      { status: 400 }
    );
  }

  try {
    const supabase = createServiceRoleSupabase();

    // احذف روابط المتغيرات أولاً
    const { error: delLinks } = await supabase
      .from("variant_option_values")
      .delete()
      .eq("option_value_id", valueId);
    if (delLinks) throw delLinks;

    // ثم احذف القيمة نفسها
    const { error: delVal } = await supabase
      .from("product_option_values")
      .delete()
      .eq("id", valueId);
    if (delVal) throw delVal;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || e },
      { status: 500 }
    );
  }
}
