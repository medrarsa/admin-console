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
  const supabase = createServiceRoleSupabase();
  try {
    // اجلب القيم التابعة للمجموعة
    const { data: vals } = await supabase
      .from("product_option_values")
      .select("id")
      .eq("option_id", groupId);
    const valIds = (vals ?? []).map((v) => v.id);

    // احذف روابط القيم ثم القيم ثم المجموعة
    if (valIds.length) {
      await supabase
        .from("variant_option_values")
        .delete()
        .in("option_value_id", valIds);
      await supabase.from("product_option_values").delete().in("id", valIds);
    }
    await supabase.from("product_options").delete().eq("id", groupId);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || e },
      { status: 500 }
    );
  }
}
