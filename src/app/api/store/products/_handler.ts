import createServerSupabase from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const ok = (data: any, status = 200) =>
  NextResponse.json({ success: true, data }, { status });
export const fail = (error: string, status = 400, meta?: any) =>
  NextResponse.json({ success: false, error, meta }, { status });

function fullyDecode(s: string) {
  let prev = s ?? "";
  for (;;) {
    try {
      const dec = decodeURIComponent(prev);
      if (dec === prev) return dec;
      prev = dec;
    } catch {
      return prev;
    }
  }
}

/** يحاول تصحيح سلاج مثل: اسم-فيه-أرقام2028 → 2028-اسم-فيه-أرقام */
function swapDigitsTail(slug: string) {
  const m = slug.match(/^(.*?)-?(\d{2,})$/);
  if (!m) return null;
  const name = m[1].replace(/-+$/g, "");
  const digits = m[2];
  if (!name) return null;
  return `${digits}-${name}`;
}

export async function handleGetBySlug(rawInput: string) {
  const supabase = await createServerSupabase();

  const slug = fullyDecode(rawInput)
    .trim()
    .replace(/^\/+|\/+$/g, "");
  if (!slug) return fail("INVALID_SLUG", 400, { rawInput });

  // 1) جرّب كما هو
  let productId: string | null = null;
  const { data: sp0 } = await supabase
    .from("seo_pages")
    .select("entity_id")
    .eq("entity_type", "product")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (sp0?.entity_id) productId = sp0.entity_id as string;

  // 2) لو مافيه، جرّب تصحيح السلاج (نقل الأرقام للبداية)
  if (!productId) {
    const swapped = swapDigitsTail(slug);
    if (swapped) {
      const { data: sp1 } = await supabase
        .from("seo_pages")
        .select("entity_id")
        .eq("entity_type", "product")
        .eq("slug", swapped)
        .eq("is_active", true)
        .maybeSingle();
      if (sp1?.entity_id) productId = sp1.entity_id as string;
    }
  }

  if (!productId) return fail("PRODUCT_NOT_FOUND", 404, { slug });

  // المنتج
  const { data: p } = await supabase
    .from("products")
    .select("id,name,description_html,status,brand_id")
    .eq("id", productId)
    .single();
  if (!p || p.status !== "active")
    return fail("PRODUCT_NOT_FOUND", 404, { productId });

  // العلامة
  let brand_name: string | null = null;
  if (p.brand_id) {
    const { data: b } = await supabase
      .from("brands")
      .select("name")
      .eq("id", p.brand_id)
      .maybeSingle();
    brand_name = b?.name ?? null;
  }

  // الصور
  const { data: imgs } = await supabase
    .from("product_images")
    .select("url,is_primary,sort_order,created_at")
    .eq("product_id", productId)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const images = (imgs ?? []).map((x) => x.url);

  // الخيارات + القيم
  const { data: groups } = await supabase
    .from("product_options")
    .select("id,name,sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });
  const gids = (groups ?? []).map((g) => g.id);

  const { data: values } = await supabase
    .from("product_option_values")
    .select("id,option_id,name,display_value,sort_order")
    .in(
      "option_id",
      gids.length ? gids : ["00000000-0000-0000-0000-000000000000"]
    )
    .order("sort_order", { ascending: true });

  const option_groups = (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    values: (values ?? [])
      .filter((v) => v.option_id === g.id)
      .map((v) => ({
        id: v.id,
        label: v.name,
        value_code: v.display_value ?? null,
      })),
  }));

  // المتغيرات + الأسعار
  const { data: vars } = await supabase
    .from("product_variants")
    .select("id,product_id,sku,status,created_at")
    .eq("product_id", productId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  const vids = (vars ?? []).map((v) => v.id);

  const { data: vvals } = await supabase
    .from("variant_option_values")
    .select("variant_id,option_value_id")
    .in(
      "variant_id",
      vids.length ? vids : ["00000000-0000-0000-0000-000000000000"]
    );

  const { data: pprices } = await supabase
    .from("product_primary_price")
    .select("variant_id,list_price,sale_price,ends_at")
    .in(
      "variant_id",
      vids.length ? vids : ["00000000-0000-0000-0000-000000000000"]
    );

  const byV = new Map<
    string,
    {
      list_price: number | null;
      sale_price: number | null;
      ends_at: string | null;
    }
  >();
  for (const r of pprices ?? []) {
    byV.set(r.variant_id, {
      list_price: (r as any).list_price ?? null,
      sale_price: (r as any).sale_price ?? null,
      ends_at: (r as any).ends_at ?? null,
    });
  }

  const pick = (
    price: number | null,
    sale: number | null,
    ends: string | null
  ) =>
    sale != null &&
    price != null &&
    sale < price &&
    (!ends || new Date(ends) > new Date())
      ? { price, sale_price: sale, ends_at: ends }
      : {
          price,
          sale_price: null as number | null,
          ends_at: null as string | null,
        };

  const variants = (vars ?? []).map((v) => {
    const m = byV.get(v.id) ?? {
      list_price: null,
      sale_price: null,
      ends_at: null,
    };
    const pr = pick(m.list_price, m.sale_price, m.ends_at);
    const value_ids = (vvals ?? [])
      .filter((x) => x.variant_id === v.id)
      .map((x) => x.option_value_id);
    return { id: v.id, sku: v.sku, status: v.status, value_ids, ...pr };
  });

  let price: number | null = null,
    sale_price: number | null = null,
    ends_at: string | null = null;
  for (const v of variants) {
    const d = v.sale_price ?? v.price;
    if (d == null) continue;
    if (price == null || d < (sale_price ?? price)) {
      price = v.price ?? null;
      sale_price = v.sale_price ?? null;
      ends_at = v.ends_at ?? null;
    }
  }

  const main_sku = vars && vars.length ? vars[0].sku : null;
  const starts_from = (variants?.length ?? 0) > 1;

  return ok({
    id: p.id,
    name: p.name,
    slug, // نعيد السلاج الذي دخل به المستخدم (للعرض)
    brand_name,
    description_html: p.description_html,
    images,
    option_groups,
    variants,
    price,
    sale_price,
    ends_at,
    starts_from,
    main_sku,
  });
}
