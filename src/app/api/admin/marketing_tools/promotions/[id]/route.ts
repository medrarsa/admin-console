// src/app/api/admin/marketing_tools/promotions/[id]/route.ts
import { NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

// ---- Types من الواجهة (قد ترسل عربي) ----
type Incoming = {
  status?: string; // "active" | "paused" | "scheduled" | "expired" | "inactive" | "deleted" | "مفعل" | "معطل" | "موقّف" | "مجدول" | "منتهي"
  name?: string;
  channels?: string[];
  min_subtotal?: number | null;
  once_per_order?: boolean;
  usage_limit?: number | null;
  per_customer_limit?: number | null;
  starts_at?: string | null; // ISO
  ends_at?: string | null; // ISO
  free_shipping?: boolean;
  config?: {
    discount_type?: "percent" | "amount";
    value?: number;
    max_discount?: number | null;
    code?: string;
  };
};

// ---- Helpers ----
function isoOrNull(v?: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** يحوّل القيمة (إنجلش/عربي) إلى حالتين: promoStatus و couponStatus */
function normalizeStatus(raw?: string): {
  promo?: "active" | "paused" | "expired" | "scheduled";
  coupon?: "active" | "inactive" | "deleted";
} {
  if (!raw) return {};
  const s = String(raw).trim().toLowerCase();

  if (["active", "مفعل", "مفعّل"].includes(s)) {
    return { promo: "active", coupon: "active" };
  }
  if (["paused", "inactive", "معطل", "مُعطّل", "موقّف", "موقف"].includes(s)) {
    return { promo: "paused", coupon: "inactive" };
  }
  if (["scheduled", "مجدول"].includes(s)) {
    return { promo: "scheduled", coupon: "active" }; // يظل الكوبون نشط، التحكم عبر start/end
  }
  if (["expired", "منتهي", "منتهى"].includes(s)) {
    return { promo: "expired", coupon: "inactive" };
  }
  if (["deleted", "محذوف"].includes(s)) {
    return { promo: "paused", coupon: "deleted" };
  }
  // افتراضي: لا نغيّر شيء
  return {};
}

/* ----------------------- GET (يدعم coupon.id أو promotion.id) ----------------------- */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const supabase = createServiceRoleSupabase();

    // جرب id كـ coupon.id أولاً
    let coupon: any = null;
    let promotionId: string | null = null;

    const { data: cById } = await supabase
      .from("coupons")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (cById) {
      coupon = cById;
      promotionId = cById.promotion_id as string;
    } else {
      // وإلا اعتبره promotion.id
      const { data: cByPromo } = await supabase
        .from("coupons")
        .select("*")
        .eq("promotion_id", id)
        .maybeSingle();
      if (!cByPromo)
        return NextResponse.json(
          { success: false, error: "Coupon/Promotion not found" },
          { status: 404 }
        );
      coupon = cByPromo;
      promotionId = cByPromo.promotion_id as string;
    }

    const { data: promo, error: ePromo } = await supabase
      .from("promotions")
      .select("*")
      .eq("id", promotionId)
      .single();
    if (ePromo || !promo)
      return NextResponse.json(
        { success: false, error: ePromo?.message || "Promotion not found" },
        { status: 404 }
      );

    return NextResponse.json(
      {
        success: true,
        data: {
          id: coupon.id,
          code: coupon.code,
          type: coupon.type,
          status: coupon.status,
          amount:
            coupon.amount != null
              ? {
                  amount: Number(coupon.amount),
                  currency: coupon.amount_currency ?? "SAR",
                }
              : null,
          minimum_amount: coupon.minimum_amount ?? null,
          maximum_amount:
            coupon.maximum_amount != null
              ? {
                  amount: Number(coupon.maximum_amount),
                  currency: coupon.maximum_amount_currency ?? "SAR",
                }
              : null,
          show_maximum_amount: !!coupon.show_maximum_amount,
          starts_at: coupon.starts_at ?? null,
          ends_at: coupon.ends_at ?? null,
          free_shipping: Boolean(promo.free_shipping || coupon.free_shipping),
          usage_limit: coupon.usage_limit ?? null,
          usage_limit_per_user: coupon.per_customer_limit ?? null,
          applied_in: (promo.applied_in as any) ?? "all",
          promotion: promo,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("GET /promotions/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}

/* ----------------------- PATCH (يُحدّث حسب promotion_id) ----------------------- */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params; // هذا هو promotion_id
    const body = (await req.json()) as Incoming;
    const supabase = createServiceRoleSupabase();

    // تطبيع الحالة (عربي/إنجليزي) إلى قيَم صحيحة للجدولين
    const st = normalizeStatus(body.status);

    // تحديث promotion
    const promoUpdates: any = {};
    if (body.name !== undefined) promoUpdates.name = body.name;
    if (st.promo) promoUpdates.status = st.promo;
    if (body.starts_at !== undefined)
      promoUpdates.starts_at = isoOrNull(body.starts_at);
    if (body.ends_at !== undefined)
      promoUpdates.ends_at = isoOrNull(body.ends_at);
    if (body.channels !== undefined) {
      const arr =
        Array.isArray(body.channels) && body.channels.length
          ? `{${body.channels.join(",")}}`
          : "{web}";
      promoUpdates.channels = arr as unknown as any; // عمودك ARRAY عام
      promoUpdates.applied_in =
        body.channels.length > 1
          ? "all"
          : (body.channels[0] as "web" | "app") ?? "web";
    }
    if (body.min_subtotal !== undefined)
      promoUpdates.min_subtotal = body.min_subtotal;
    if (body.once_per_order !== undefined)
      promoUpdates.once_per_order = body.once_per_order;
    if (body.free_shipping !== undefined)
      promoUpdates.free_shipping = !!body.free_shipping;

    if (Object.keys(promoUpdates).length > 0) {
      const { error: e1 } = await supabase
        .from("promotions")
        .update(promoUpdates)
        .eq("id", id);
      if (e1)
        return NextResponse.json(
          { success: false, error: e1.message },
          { status: 400 }
        );
    }

    // تحديث coupon المرتبط
    const couponUpdates: any = {};
    if (body.config?.code !== undefined)
      couponUpdates.code = (body.config.code || "").trim();
    if (body.config?.discount_type !== undefined)
      couponUpdates.type =
        body.config.discount_type === "percent" ? "percentage" : "fixed";
    if (body.config?.value !== undefined)
      couponUpdates.amount = Number(body.config.value);
    if (body.config?.max_discount !== undefined)
      couponUpdates.maximum_amount =
        body.config.max_discount == null
          ? null
          : Number(body.config.max_discount);
    if (body.starts_at !== undefined)
      couponUpdates.starts_at = isoOrNull(body.starts_at);
    if (body.ends_at !== undefined)
      couponUpdates.ends_at = isoOrNull(body.ends_at);
    if (st.coupon) couponUpdates.status = st.coupon;
    if (body.usage_limit !== undefined)
      couponUpdates.usage_limit =
        body.usage_limit == null ? null : Number(body.usage_limit);
    if (body.per_customer_limit !== undefined)
      couponUpdates.per_customer_limit =
        body.per_customer_limit == null
          ? null
          : Number(body.per_customer_limit);
    if (body.min_subtotal !== undefined)
      couponUpdates.minimum_amount =
        body.min_subtotal == null ? null : Number(body.min_subtotal);
    if (body.free_shipping !== undefined)
      couponUpdates.free_shipping = !!body.free_shipping;
    if (body.channels !== undefined)
      couponUpdates.applied_in =
        body.channels.length > 1
          ? "all"
          : (body.channels[0] as "web" | "app") ?? "web";

    if (Object.keys(couponUpdates).length > 0) {
      const { error: e2 } = await supabase
        .from("coupons")
        .update(couponUpdates)
        .eq("promotion_id", id);
      if (e2)
        return NextResponse.json(
          { success: false, error: e2.message },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("PATCH /promotions/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
