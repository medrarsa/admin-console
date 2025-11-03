// src/app/api/admin/products/options/group/[groupId]/route.ts
import { NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await ctx.params;
  if (!groupId) {
    return NextResponse.json(
      { success: false, message: "Missing groupId" },
      { status: 400 }
    );
  }

  try {
    const supabase = createServiceRoleSupabase();

    // اجلب القيم التابعة للمجموعة
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

      // ثم القيم نفسها
      const { error: delVals } = await supabase
        .from("product_option_values")
        .delete()
        .in("id", valIds);
      if (delVals) throw delVals;
    }

    // أخيرًا احذف المجموعة
    const { error: delGroup } = await supabase
      .from("product_options")
      .delete()
      .eq("id", groupId);
    if (delGroup) throw delGroup;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || e },
      { status: 500 }
    );
  }
}
