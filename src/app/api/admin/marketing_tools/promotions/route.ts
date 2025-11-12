// src/app/api/admin/marketing_tools/promotions/route.ts
import { NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

/* ======================= Types (للـ POST فقط) ======================= */
type Incoming = {
  kind: "coupon";
  status: string;
  name: string;
  channels: string[];
  min_subtotal: number | null;
  once_per_order: boolean;
  usage_limit: number | null;
  per_customer_limit: number | null;
  starts_at: string | null;
  ends_at: string | null;
  free_shipping?: boolean;
  config: {
    discount_type: "percent" | "amount";
    value: number;
    max_discount?: number | null;
    code: string;
  };
};

/* helpers */
function toTextArray(xs?: string[]) {
  if (!Array.isArray(xs) || xs.length === 0) return "{web}";
  return `{${xs.map((s) => s).join(",")}}`;
}
function isoOrNull(v: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/* ======================= POST: Create Coupon ======================= */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Incoming;

    const code = (body.config?.code || "").trim();
    if (!code) {
      return NextResponse.json(
        { success: false, error: "code is required" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleSupabase();

    const name = body.name?.trim() || code;
    const type =
      body.config.discount_type === "percent" ? "percentage" : "fixed";
    const amount = Number(body.config.value || 0);
    const maxDiscount =
      body.config.max_discount == null
        ? null
        : Number(body.config.max_discount);
    const minSubtotal =
      body.min_subtotal == null ? null : Number(body.min_subtotal);
    const startsAt = isoOrNull(body.starts_at);
    const endsAt = isoOrNull(body.ends_at);
    const channelsTextArr = toTextArray(body.channels);
    const appliedIn =
      Array.isArray(body.channels) && body.channels.length > 1
        ? "all"
        : (body.channels?.[0] as "web" | "app") ?? "web";
    const freeShipping = !!body.free_shipping;
    const usageLimit =
      body.usage_limit == null ? null : Number(body.usage_limit);
    const perCustomerLimit =
      body.per_customer_limit == null ? null : Number(body.per_customer_limit);
    const oncePerOrder = body.once_per_order !== false;

    // 1) promotions
    const { data: promo, error: e1 } = await supabase
      .from("promotions")
      .insert({
        name,
        kind: "coupon",
        status: body.status || "active",
        starts_at: startsAt,
        ends_at: endsAt,
        channels: channelsTextArr as unknown as any, // عمودك ARRAY عام
        min_subtotal: minSubtotal,
        once_per_order: oncePerOrder,
        free_shipping: freeShipping,
        applied_in: appliedIn,
        show_maximum_amount: false,
        is_sale_products_exclude: false,
      })
      .select("*")
      .single();

    if (e1 || !promo) {
      return NextResponse.json(
        { success: false, error: e1?.message || "insert promotions failed" },
        { status: 400 }
      );
    }

    // 2) coupons
    const { data: coupon, error: e2 } = await supabase
      .from("coupons")
      .insert({
        promotion_id: promo.id,
        code,
        type,
        status: body.status || "active",
        amount,
        amount_currency: "SAR",
        maximum_amount: maxDiscount,
        maximum_amount_currency: "SAR",
        minimum_amount: minSubtotal,
        starts_at: startsAt,
        ends_at: endsAt,
        usage_limit: usageLimit,
        per_customer_limit: perCustomerLimit,
        free_shipping: freeShipping,
        applied_in: appliedIn,
        show_maximum_amount: false,
        is_apply_with_offer: null,
      })
      .select("*")
      .single();

    if (e2 || !coupon) {
      await supabase.from("promotions").delete().eq("id", promo.id);
      return NextResponse.json(
        {
          success: false,
          error: e2?.message || "insert coupons failed (maybe duplicate code?)",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, data: { promotion: promo, coupon } },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("POST /promotions error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}

/* ======================= GET: List Coupons ======================= */
export async function GET() {
  try {
    const supabase = createServiceRoleSupabase();

    const { data: rows, error } = await supabase
      .from("coupons")
      .select(
        `
        id, code, type, status,
        amount, minimum_amount, maximum_amount,
        starts_at, ends_at, free_shipping,
        usage_limit, per_customer_limit,
        promotions:promotion_id ( id, name, status, free_shipping, starts_at, ends_at, applied_in )
      `
      )
      .order("starts_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    // ❌ لا تعمل cast صارم لـ TypeScript — رجّع البيانات كما هي
    return NextResponse.json(
      { success: true, data: rows ?? [] },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("GET /promotions error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
