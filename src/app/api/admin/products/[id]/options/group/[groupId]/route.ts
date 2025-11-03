// src/app/api/admin/products/[id]/options/group/[groupId]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; groupId: string }> }
) {
  const { id: productId, groupId } = await ctx.params;
  if (!productId || !groupId) {
    return NextResponse.json(
      { success: false, message: "Missing productId/groupId" },
      { status: 400 }
    );
  }

  try {
    const supabase = createServiceRoleSupabase();

    // احضر القيم التابعة للمجموعة
    const { data: vals, error: valsErr } = await supabase
      .from("product_option_values")
      .select("id")
      .eq("option_id", groupId);
    if (valsErr) throw valsErr;

    const valIds = (vals ?? []).map((v) => v.id);

    // احذف روابط المتغيرات أولاً
    if (valIds.length) {
      const { error: delLinks } = await supabase
        .from("variant_option_values")
        .delete()
        .in("option_value_id", valIds);
      if (delLinks) throw delLinks;

      // ثم احذف القيم
      const { error: delVals } = await supabase
        .from("product_option_values")
        .delete()
        .in("id", valIds);
      if (delVals) throw delVals;
    }

    // احذف المجموعة نفسها
    const { error: delGroup } = await supabase
      .from("product_options")
      .delete()
      .eq("id", groupId)
      .eq("product_id", productId);
    if (delGroup) throw delGroup;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || e },
      { status: 500 }
    );
  }
}
