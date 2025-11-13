import { NextResponse } from "next/server";
import createServerSupabase from "@/lib/supabase/server";
import { cookies } from "next/headers";

/** يقرأ السلة من الـ RPC بعد تثبيت GUC للـ session_id */
export async function GET() {
  try {
    const jar = await cookies();
    const sid = jar.get("sid")?.value || null;

    const supabase = await createServerSupabase();

    // 1) لو في sid ثبّت GUC قبل أي RPC/SELECT عشان RLS/الحسابات تشوف الجلسة الصحيحة
    if (sid) {
      await supabase.rpc("set_request_session_id", { val: sid });
    }

    // (اختياري) قراءة المستخدم — لو سجل دخول
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id ?? null;

    // 2) نقرأ السلة من PL/pgSQL اللي يحسب الخصم والشحن
    const { data, error } = await supabase.rpc("get_cart_for_session", {
      p_user_id: userId,
      p_session_id: sid, // لازم نمرّره حتى لو ثبتنا GUC
    });
    if (error) throw error;

    // data يجب أن تحتوي totals: { subtotal, discount, shipping, grand }
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error("[cart GET] error:", e?.message || e);
    return NextResponse.json(
      { success: false, error: e?.message || "server_error" },
      { status: 500 }
    );
  }
}
