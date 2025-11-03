// src/app/api/admin/products/options/value/[valueId]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

export async function DELETE(
  _req: Request,
  ctx: { params: { valueId: string } } // ← لا تستخدم Promise هنا
) {
  const { valueId } = ctx.params;
  if (!valueId) {
    return NextResponse.json(
      { success: false, message: "Missing valueId" },
      { status: 400 }
    );
  }

  try {
    const supabase = createServiceRoleSupabase();

    // احذف الروابط أولاً
    const { error: delLinks } = await supabase
      .from("variant_option_values")
      .delete()
      .eq("option_value_id", valueId);
    if (delLinks) throw delLinks;

    // احذف القيمة
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
