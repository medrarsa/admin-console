import { NextResponse } from "next/server";
import createServerSupabase from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const COUPONS = "coupons";
const PROMOTIONS = "promotions";

const num = (v: any, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const boolish = (v: any) => v === true || v === "true" || v === 1 || v === "1";

async function getAuthAndSid() {
  const jar = await cookies();
  let sid = jar.get("sid")?.value || null;
  if (!sid) {
    sid = randomUUID();
    jar.set("sid", sid, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
  }
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;
  return { supabase, userId, sid };
}

export async function POST(req: Request) {
  try {
    const { supabase, userId, sid } = await getAuthAndSid();
    const { code } = (await req.json().catch(() => ({}))) as { code?: string };
    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { success: false, error: "bad_request", message: "أدخل كود صالح" },
        { status: 400 }
      );
    }

    /* ========= أهم خطوة: ثبّت الـ GUC قبل أي UPDATE يخضع لـ RLS ========= */
    await supabase.rpc("set_request_session_id", { val: sid });

    /* السلة (من الـ RPC الموحد) */
    const { data: cartJson, error: cartErr } = await supabase.rpc(
      "get_cart_for_session",
      {
        p_user_id: userId,
        p_session_id: sid,
      }
    );
    if (cartErr) throw cartErr;
    const cart_id = cartJson?.cart_id ?? null;
    const subtotal = num(cartJson?.totals?.subtotal, 0);
    const currentShipping = num(cartJson?.totals?.shipping, 0);

    /* الكوبون */
    const { data: coupon, error: cErr } = await supabase
      .from(COUPONS)
      .select(
        "id, code, status, starts_at, ends_at, start_date, expiry_date, type, amount, maximum_amount, minimum_amount, free_shipping, promotion_id"
      )
      .eq("code", code)
      .limit(1)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!coupon)
      return NextResponse.json(
        { success: false, error: "code_not_found", message: "الكود غير موجود" },
        { status: 404 }
      );
    if (["inactive", "deleted"].includes(String(coupon.status))) {
      return NextResponse.json(
        { success: false, error: "not_active", message: "الكوبون غير مفعل" },
        { status: 400 }
      );
    }

    /* البروموشن */
    const { data: promo, error: pErr } = await supabase
      .from(PROMOTIONS)
      .select(
        "id, kind, status, starts_at, ends_at, min_subtotal, free_shipping, marketing_type, marketing_amount, marketing_maximum_amount"
      )
      .eq("id", coupon.promotion_id)
      .limit(1)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!promo || String(promo.kind) !== "coupon") {
      return NextResponse.json(
        {
          success: false,
          error: "code_not_found",
          message: "العرض المرتبط غير صالح",
        },
        { status: 404 }
      );
    }

    /* تحقق الوقت والحد الأدنى */
    const startIso = coupon.starts_at || coupon.start_date || promo.starts_at;
    const endIso = coupon.ends_at || coupon.expiry_date || promo.ends_at;
    const now = new Date();
    if (promo.status && ["paused", "expired"].includes(String(promo.status))) {
      return NextResponse.json(
        { success: false, error: "not_active", message: "العرض غير مفعل" },
        { status: 400 }
      );
    }
    if (startIso && now < new Date(startIso)) {
      return NextResponse.json(
        { success: false, error: "not_active", message: "الكوبون لم يبدأ بعد" },
        { status: 400 }
      );
    }
    if (endIso && now > new Date(endIso)) {
      return NextResponse.json(
        {
          success: false,
          error: "not_active",
          message: "انتهت صلاحية الكوبون",
        },
        { status: 400 }
      );
    }
    const minSubtotal = num(coupon.minimum_amount ?? promo.min_subtotal, 0);
    if (subtotal < minSubtotal) {
      return NextResponse.json(
        {
          success: false,
          error: "min_subtotal_not_met",
          message: `الحد الأدنى للطلب ${minSubtotal.toFixed(2)} ر.س`,
        },
        { status: 400 }
      );
    }

    /* حساب الخصم */
    const rawType =
      coupon.type ?? (promo.marketing_type as string | null) ?? "fixed"; // 'percentage'|'fixed'|'p'|'f'
    const typeNorm = (() => {
      const t = String(rawType).toLowerCase();
      if (t.startsWith("p")) return "percentage";
      if (t.startsWith("f")) return "fixed";
      return t === "percentage" ? "percentage" : "fixed";
    })();
    const amount = Number.isFinite(Number(coupon.amount))
      ? Number(coupon.amount)
      : Number(promo.marketing_amount) || 0;
    const maxCap = Number.isFinite(Number(coupon.maximum_amount))
      ? Number(coupon.maximum_amount) || null
      : Number(promo.marketing_maximum_amount) || null;
    const freeShipping = boolish(
      coupon.free_shipping ?? promo.free_shipping ?? false
    );

    let discount = 0;
    if (typeNorm === "percentage") {
      discount = Math.max(0, (subtotal * amount) / 100);
      if (maxCap) discount = Math.min(discount, maxCap);
    } else {
      discount = Math.min(subtotal, Math.max(0, amount));
    }

    /* حفظ حالة الكوبون على carts — الآن بعد set_request_session_id سيمر RLS */
    let stored = false;
    if (cart_id) {
      const { data: upData, error: upErr } = await supabase
        .from("carts")
        .update({
          applied_coupon_code: coupon.code,
          applied_coupon_data: {
            type: typeNorm,
            amount,
            maximum_amount: maxCap,
            free_shipping: freeShipping,
            promotion_id: promo.id,
            coupon_id: coupon.id,
          },
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", cart_id)
        .select("id")
        .maybeSingle();
      stored = !!upData && !upErr;
      if (upErr) console.warn("[apply-coupon] store failed:", upErr.message);
    }

    /* الرد + كوكي */
    const shipping = freeShipping ? 0 : currentShipping;
    const totalBefore = subtotal + shipping;
    const totalAfter = Math.max(0, totalBefore - discount);

    const res = NextResponse.json({
      success: true,
      data: {
        cart_id,
        code: coupon.code,
        discount,
        discount_type: typeNorm,
        free_shipping: freeShipping,
        stored,
        cart: { subtotal, shipping, total: totalAfter },
      },
    });
    res.headers.append(
      "Set-Cookie",
      `coupon_code=${encodeURIComponent(coupon.code)}; Path=/; Max-Age=${
        60 * 60 * 24 * 30
      }; SameSite=Lax`
    );
    return res;
  } catch (e: any) {
    console.error("[apply-coupon] error:", e?.message || e);
    return NextResponse.json(
      { success: false, error: "server_error" },
      { status: 500 }
    );
  }
}
