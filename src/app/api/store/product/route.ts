// src/app/api/store/product/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import createServerSupabase from "@/lib/supabase/server";

const ok = (data: any, status = 200) =>
  NextResponse.json({ success: true, data }, { status });
const fail = (error: string, status = 400, meta?: any) =>
  NextResponse.json({ success: false, error, meta }, { status });

function fullyDecode(s: string) {
  let p = s ?? "";
  for (;;) {
    try {
      const d = decodeURIComponent(p);
      if (d === p) return d;
      p = d;
    } catch {
      return p;
    }
  }
}
const num = (x: any) =>
  x == null ? null : Number(x) === Number(x) ? Number(x) : null;
const now = () => new Date();

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const url = new URL(req.url);
  const raw = url.searchParams.get("slug") || "";
  const slug = fullyDecode(raw).trim();
  if (!slug) return fail("INVALID_SLUG", 400, { raw });

  // 1) slug -> product
  const { data: sp } = await supabase
    .from("seo_pages")
    .select("entity_id,is_active")
    .eq("entity_type", "product")
    .eq("slug", slug)
    .maybeSingle();
  if (!sp || sp.is_active !== true)
    return fail("PRODUCT_NOT_FOUND", 404, { slug });

  const pid = sp.entity_id as string;

  const { data: p } = await supabase
    .from("products")
    .select("id,name,description_html,status,brand_id")
    .eq("id", pid)
    .single();
  if (!p || p.status !== "active")
    return fail("PRODUCT_NOT_FOUND", 404, { pid });

  let brand_name: string | null = null;
  if (p.brand_id) {
    const { data: b } = await supabase
      .from("brands")
      .select("name")
      .eq("id", p.brand_id)
      .maybeSingle();
    brand_name = b?.name ?? null;
  }

  // 2) images (مصفوفة كاملة)
  const { data: imgs } = await supabase
    .from("product_images")
    .select("url,is_primary,sort_order,created_at")
    .eq("product_id", pid)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const images = (imgs ?? []).map((x) => x.url).filter(Boolean) as string[];

  // 3) options (choice/addon)
  const { data: groups } = await supabase
    .from("product_options")
    .select("id,name,sort_order,type,display_type")
    .eq("product_id", pid)
    .order("sort_order", { ascending: true });
  const gids = (groups ?? []).map((g) => g.id);
  const { data: vals } = await supabase
    .from("product_option_values")
    .select("id,option_id,name,display_value,sort_order,extra_price")
    .in(
      "option_id",
      gids.length ? gids : ["00000000-0000-0000-0000-000000000000"]
    )
    .order("sort_order", { ascending: true });

  const option_groups = (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    kind: g.type === "checkbox" ? "addon" : ("choice" as "addon" | "choice"),
    display_type: g.display_type,
    values: (vals ?? [])
      .filter((v) => v.option_id === g.id)
      .map((v) => ({
        id: v.id,
        label: v.name,
        value_code: v.display_value ?? null,
        extra_price: num(v.extra_price) ?? 0,
      })),
  }));

  // 4) variants & mapping
  const { data: vars } = await supabase
    .from("product_variants")
    .select("id,product_id,sku,status,created_at")
    .eq("product_id", pid)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (!vars?.length) {
    // لا متغيرات: أعِد منتج بلا خيارات/أسعار
    return ok({
      id: p.id,
      name: p.name,
      slug,
      brand_name,
      description_html: p.description_html,
      images,
      option_groups,
      variants: [],
      main_variant_id: null,
      base_price_fallback: null,
      base_qty_fallback: 0,
      variants_min_price: null,
      variants_max_price: null,
      variants_total_qty: 0,
      starts_from: false,
    });
  }
  const main_variant_id = vars[0].id as string;
  const secondaryIds = vars.slice(1).map((v) => v.id as string);

  const { data: vvals } = await supabase
    .from("variant_option_values")
    .select("variant_id,option_value_id")
    .in(
      "variant_id",
      vars.map((v) => v.id)
    );

  const variants = (vars ?? []).map((v) => {
    const value_ids = (vvals ?? [])
      .filter((x) => x.variant_id === v.id)
      .map((x) => x.option_value_id);
    return { id: v.id, sku: v.sku, status: v.status, value_ids };
  });

  // 5) fallback base price from product_primary_price(main)
  const { data: ppMain } = await supabase
    .from("product_primary_price")
    .select("list_price,sale_price,ends_at")
    .eq("variant_id", main_variant_id)
    .maybeSingle();
  const base_list = num(ppMain?.list_price);
  const base_price_fallback = base_list ?? null;

  // base qty fallback
  const { data: invMain } = await supabase
    .from("variant_inventory")
    .select("qty_on_hand,qty_reserved")
    .eq("variant_id", main_variant_id);
  let base_qty_fallback = 0;
  for (const r of invMain ?? []) {
    const net = Math.max(
      0,
      (num(r.qty_on_hand) ?? 0) - (num(r.qty_reserved) ?? 0)
    );
    base_qty_fallback += net;
  }

  // 6) latest price per variant for min/max
  let variants_min_price: number | null = null;
  let variants_max_price: number | null = null;
  let variants_total_qty = 0;

  if (secondaryIds.length) {
    const { data: vp } = await supabase
      .from("variant_prices")
      .select("variant_id,price,sale_price,starts_at,ends_at")
      .in("variant_id", secondaryIds)
      .order("variant_id", { ascending: true })
      .order("starts_at", { ascending: false });

    const latestByVid = new Map<
      string,
      { price: number | null; sale: number | null; ends: string | null }
    >();
    for (const r of vp ?? []) {
      if (!latestByVid.has(r.variant_id)) {
        latestByVid.set(r.variant_id, {
          price: num(r.price),
          sale: num(r.sale_price),
          ends: (r.ends_at as any) ?? null,
        });
      }
    }

    // qty for secondary
    const { data: invSec } = await supabase
      .from("variant_inventory")
      .select("variant_id,qty_on_hand,qty_reserved")
      .in("variant_id", secondaryIds);
    for (const r of invSec ?? []) {
      const net = Math.max(
        0,
        (num(r.qty_on_hand) ?? 0) - (num(r.qty_reserved) ?? 0)
      );
      variants_total_qty += net ?? 0;
    }

    for (const vid of secondaryIds) {
      const pr = latestByVid.get(vid);
      if (!pr) continue;
      const base = pr.price;
      const sale = pr.sale;
      const display = sale != null && base != null && sale < base ? sale : base;
      if (display == null) continue;
      if (variants_min_price == null || display < variants_min_price)
        variants_min_price = display;
      if (variants_max_price == null || display > variants_max_price)
        variants_max_price = display;
    }
  }

  if (variants_min_price == null && base_price_fallback != null) {
    variants_min_price = base_price_fallback;
    variants_max_price = base_price_fallback;
  }

  const starts_from = (variants?.length ?? 0) > 1;

  return ok({
    id: p.id,
    name: p.name,
    slug,
    brand_name,
    description_html: p.description_html,
    images, // ⬅️ مصفوفة الصور ترجع هنا
    option_groups,
    variants,
    main_variant_id,
    base_price_fallback,
    base_qty_fallback,
    variants_min_price,
    variants_max_price,
    variants_total_qty,
    starts_from,
  });
}
