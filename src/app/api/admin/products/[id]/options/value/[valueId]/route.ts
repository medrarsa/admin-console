// src/app/api/admin/products/options/value/[valueId]/route.ts
import { NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ valueId: string }> }
) {
  const { valueId } = await ctx.params;
  if (!valueId) {
    return NextResponse.json(
      { success: false, message: "Missing valueId" },
      { status: 400 }
    );
  }
  const supabase = createServiceRoleSupabase();
  try {
    // احذف روابط المتغيرات أولاً
    await supabase
      .from("variant_option_values")
      .delete()
      .eq("option_value_id", valueId);
    // ثم احذف قيمة الخيار
    await supabase.from("product_option_values").delete().eq("id", valueId);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || e },
      { status: 500 }
    );
  }
}
