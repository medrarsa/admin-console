// src/app/api/admin/products/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import createServerSupabase from "@/lib/supabase/server";

const ok = (data: any, status = 200) =>
  NextResponse.json({ success: true, data }, { status });
const fail = (error: string, status = 400, meta?: any) =>
  NextResponse.json({ success: false, error, meta }, { status });

const num = (x: any) =>
  x == null ? null : Number(x) === Number(x) ? Number(x) : null;
const now = () => new Date();

/* =====================[ GET ]===================== */
/**
 * GET /api/admin/products/:id
 * يرجّع price_canonical للمنتج (موحّد) + بعض الحقول الأساسية
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> } // ⬅️ Next 15 expects Promise
) {
  try {
    const { id: pid } = await context.params; // ⬅️ ننتظر params
    const supabase = await createServerSupabase();

    // المنتج موجود؟
    const { data: prod, error: eProd } = await supabase
      .from("products")
      .select("id,name,status,brand_id,description_html")
      .eq("id", pid)
      .maybeSingle();

    if (eProd) return fail(eProd.message, 500, { where: "products/select" });
    if (!prod?.id) return fail("PRODUCT_NOT_FOUND", 404, { id: pid });

    // اجلب المتغيرات النشطة
    const { data: vars, error: eVars } = await supabase
      .from("product_variants")
      .select("id,sku,status")
      .eq("product_id", pid)
      .eq("status", "active");

    if (eVars) return fail(eVars.message, 500, { where: "variants/select" });

    const vIds = (vars ?? []).map((v) => v.id);
    let list = 0;
    let sale: number | null = null;
    let endsAt: string | null = null;

    if (vIds.length) {
      // أحدث سجل سعري لكل variant ثم نستنتج أقل عرض فعّال للمنتج
      const { data: prices, error: ePrices } = await supabase
        .from("variant_prices")
        .select("variant_id,price,sale_price,ends_at,created_at")
        .in("variant_id", vIds)
        .order("variant_id", { ascending: true })
        .order("created_at", { ascending: false });

      if (ePrices)
        return fail(ePrices.message, 500, { where: "prices/select" });

      // أحدث صف لكل variant
      const latestByVariant = new Map<
        string,
        {
          variant_id: string;
          price: number | null;
          sale_price: number | null;
          ends_at: string | null;
          created_at: string;
        }
      >();

      (prices ?? []).forEach((row) => {
        if (!latestByVariant.has(row.variant_id)) {
          latestByVariant.set(row.variant_id, {
            variant_id: row.variant_id,
            price: num(row.price),
            sale_price: num(row.sale_price),
            ends_at: row.ends_at ?? null,
            created_at: row.created_at!,
          });
        }
      });

      // اختَر أقل "عرض فعّال"
      let minDisplay: number | null = null;
      let chosenBase: number | null = null;
      let chosenSale: number | null = null;
      let chosenEnds: string | null = null;

      for (const [, row] of latestByVariant) {
        const base = row.price;
        const maybeSale =
          row.sale_price != null &&
          base != null &&
          row.sale_price < base &&
          (!row.ends_at || new Date(row.ends_at) > now())
            ? row.sale_price
            : null;

        const display = maybeSale ?? base;
        if (display == null) continue;

        if (minDisplay == null || display < minDisplay) {
          minDisplay = display;
          chosenBase = base ?? null;
          chosenSale = maybeSale;
          chosenEnds = row.ends_at ?? null;
        }
      }

      list = chosenBase ?? 0;
      sale = chosenSale ?? null;
      endsAt = chosenEnds ?? null;
    }

    const hasSale = sale != null && sale < list;

    const price_canonical = {
      list,
      sale: hasSale ? sale : null,
      label: hasSale
        ? {
            kind: "sale" as const,
            text: `${Math.round(
              ((list - (sale as number)) / list) * 100
            )}% خصم`,
          }
        : { kind: "single" as const, text: `${list}` },
    };

    return ok({
      id: prod.id,
      name: prod.name,
      status: prod.status,
      description_html: prod.description_html ?? null,
      ends_at: endsAt,
      // المصدر الموحّد للعرض في أي صفحة/كرت:
      price_canonical,
    });
  } catch (e: any) {
    return fail(e?.message || "SERVER_ERROR", 500);
  }
}

/* =====================[ POST (سِعْر المتغير + الإضافات) ]===================== */
/**
 * POST /api/admin/products/:id
 * body: { variantId: string, extras?: string[] }
 * يرجّع base/sale/total مع الإضافات
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> } // ⬅️ Promise
) {
  const { id: pid } = await context.params; // ⬅️ await
  const supabase = await createServerSupabase();
  const { variantId, extras } = (await req.json()) as {
    variantId?: string | null;
    extras?: string[]; // ids من product_option_values
  };

  // 1) base price from variant (latest retail)
  if (!variantId) return fail("VARIANT_REQUIRED", 400);
  const { data: vp } = await supabase
    .from("variant_prices")
    .select("variant_id,price,sale_price,starts_at,ends_at,price_type")
    .eq("variant_id", variantId)
    .eq("price_type", "retail")
    .order("starts_at", { ascending: false })
    .limit(1);

  const row = vp?.[0];
  if (!row) return fail("PRICE_NOT_FOUND", 404, { variantId });

  let base = num(row.price);
  const sale = num(row.sale_price);
  const ends = row.ends_at ? new Date(row.ends_at) : null;
  const active =
    sale != null && base != null && sale < base && (!ends || ends > now());
  const chosen = active ? sale! : base ?? null;
  if (chosen == null) return fail("NO_VALID_PRICE", 404, { variantId });

  // 2) sum extras
  let extrasSum = 0;
  if (extras?.length) {
    const { data: vrows } = await supabase
      .from("product_option_values")
      .select("id,extra_price")
      .in("id", extras);
    for (const e of vrows ?? []) {
      const v = num(e.extra_price);
      if (v != null) extrasSum += v;
    }
  }

  return ok({
    product_id: pid,
    variant_id: variantId,
    base_price: base,
    sale_price: active ? sale : null,
    total_price: chosen + extrasSum,
    extras_total: extrasSum,
  });
}
