import { NextResponse } from "next/server";
import createServerSupabase from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const jar = await cookies();
    const sid = jar.get("sid")?.value || null;

    const supabase = await createServerSupabase();

    // مهم: ثبّت GUC للزائر قبل أي UPDATE يخضع لـ RLS
    if (sid) {
      await supabase.rpc("set_request_session_id", { val: sid });
    }

    // المستخدم (إن وُجد)
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id ?? null;

    // نجيب cart_id عبر الـ RPC
    const { data: cartJson, error: cartErr } = await supabase.rpc(
      "get_cart_for_session",
      { p_user_id: userId, p_session_id: sid }
    );
    if (cartErr) throw cartErr;

    const cart_id = cartJson?.cart_id ?? null;

    // صفّر السلة
    if (cart_id) {
      await supabase
        .from("carts")
        .update({ applied_coupon_code: null, applied_coupon_data: null } as any)
        .eq("id", cart_id);
    }

    // رد + مسح الكوكي
    const res = NextResponse.json({ success: true, data: { removed: true } });
    res.headers.append(
      "Set-Cookie",
      "coupon_code=; Path=/; Max-Age=0; SameSite=Lax"
    );
    return res;
  } catch (e: any) {
    console.error("[remove-coupon] error:", e?.message || e);
    return NextResponse.json(
      { success: false, error: "server_error" },
      { status: 500 }
    );
  }
}
