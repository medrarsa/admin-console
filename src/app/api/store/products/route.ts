// src/app/api/store/products/route.ts
import { NextResponse } from "next/server";
import createServerSupabase from "@/lib/supabase/server";

type ProductRow = {
  id: string;
  name: string;
  seo_slug_tpl?: string | null;
  brand_id?: string | null;
  status: string;
  created_at?: string;
};
type ImageRow = {
  product_id: string;
  url: string | null;
  is_primary: boolean | null;
  sort_order: number | null;
  created_at?: string | null;
};
type VariantRow = {
  id: string;
  product_id: string;
  status?: string | null;
  created_at?: string | null;
  sku?: string | null;
};
type PriceRow = {
  variant_id: string;
  price: number;
  sale_price?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
};

const slugify = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const slug = fullyDecode(url.searchParams.get("slug") || "").trim();
    const channel = (url.searchParams.get("channel") || "web").trim();
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const size = Math.min(48, Math.max(1, Number(url.searchParams.get("size") || "24")));
    const offset = (page - 1) * size;

    const supabase = await createServerSupabase();

    /* brands */
    const { data: brands } = await supabase
      .from("brands")
      .select("id,name")
      .eq("is_active", true);
    const brandById = new Map<string, string>();
    (brands || []).forEach((b: any) => brandById.set(b.id, b.name));

    /* products */
    const baseSelect =
      "id,name,seo_slug_tpl,brand_id,status,created_at,product_channels!left(channel)";
    let productsQuery = supabase
      .from("products")
      .select(baseSelect, { count: "exact" })
      .eq("status", "active");
    if (channel) productsQuery = productsQuery.eq("product_channels.channel", channel);
    if (slug) productsQuery = productsQuery.eq("seo_slug_tpl", slug);
    else if (q) productsQuery = productsQuery.ilike("name", `%${q}%`);
    productsQuery = productsQuery
      .range(offset, offset + size - 1)
      .order("created_at", { ascending: false });

    let { data: products, error: prodErr, count } = (await productsQuery) as any;
    if (prodErr)
      return NextResponse.json({ success: false, error: prodErr.message }, { status: 500 });

    // alias من seo_pages
    if (slug && (!products || products.length === 0)) {
      const { data: sp } = await supabase
        .from("seo_pages")
        .select("entity_id")
        .eq("entity_type", "product")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (sp?.entity_id) {
        const { data: found } = await supabase
          .from("products")
          .select(baseSelect)
          .eq("id", sp.entity_id)
          .eq("status", "active")
          .limit(1);
        products = found || [];
        count = products.length;
      }
    }

    const uniq = new Map<string, any>();
    (products || []).forEach((p: any) => uniq.set(p.id, p));
    products = Array.from(uniq.values());

    const productIds = (products as ProductRow[]).map((p) => p.id);
    if (!productIds.length)
      return NextResponse.json({
        success: true,
        data: [],
        page,
        size,
        total: count ?? 0,
      });

    /* images */
    const { data: images } = await supabase
      .from("product_images")
      .select("product_id,url,is_primary,sort_order,created_at")
      .in("product_id", productIds)
      .order("product_id", { ascending: true })
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    const primaryByProduct = new Map<string, string>();
    (images as ImageRow[] | null)?.forEach((img) => {
      if (img?.url && !primaryByProduct.has(img.product_id))
        primaryByProduct.set(img.product_id, img.url);
    });

    /* variants */
    const { data: variants } = await supabase
      .from("product_variants")
      .select("id,product_id,status,created_at,sku")
      .in("product_id", productIds)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    const variantIdsByProduct = new Map<string, string[]>();
    const mainVariantByProduct = new Map<string, string>();
    (variants as VariantRow[] | null)?.forEach((v) => {
      const arr = variantIdsByProduct.get(v.product_id) || [];
      arr.push(v.id);
      variantIdsByProduct.set(v.product_id, arr);
      if (!mainVariantByProduct.has(v.product_id))
        mainVariantByProduct.set(v.product_id, v.id);
    });
    const allVariantIds = Array.from(new Set(Array.from(variantIdsByProduct.values()).flat()));

    /* latest price per variant */
    type PriceAgg = { price: number | null; sale: number | null; ends: string | null };
    const latestByVariant = new Map<string, PriceAgg>();
    if (allVariantIds.length) {
      const { data: prices } = await supabase
        .from("variant_prices")
        .select("variant_id,price,sale_price,created_at,ends_at")
        .in("variant_id", allVariantIds)
        .order("variant_id", { ascending: true })
        .order("created_at", { ascending: false });
      (prices as PriceRow[] | null)?.forEach((row: any) => {
        if (!latestByVariant.has(row.variant_id)) {
          const base = typeof row.price === "number" && row.price > 0 ? row.price : null;
          const sale =
            typeof row.sale_price === "number" &&
            base != null &&
            row.sale_price > 0 &&
            row.sale_price < base
              ? row.sale_price
              : null;
          latestByVariant.set(row.variant_id, { price: base, sale, ends: row.ends_at ?? null });
        }
      });
    }
    // fallback على product_primary_price
    const needsPrimaryFallback: string[] = [];
    for (const [pid, vIds] of variantIdsByProduct.entries()) {
      const mainId = mainVariantByProduct.get(pid);
      if (mainId && !latestByVariant.has(mainId)) needsPrimaryFallback.push(mainId);
    }
    if (needsPrimaryFallback.length) {
      try {
        const { data: prim } = await supabase
          .from("product_primary_price")
          .select("variant_id,list_price,sale_price,ends_at")
          .in("variant_id", needsPrimaryFallback);
        (prim || []).forEach((r: any) => {
          const base = typeof r.list_price === "number" && r.list_price > 0 ? r.list_price : null;
          const sale =
            typeof r.sale_price === "number" &&
            base != null &&
            r.sale_price > 0 &&
            r.sale_price < base
              ? r.sale_price
              : null;
          latestByVariant.set(r.variant_id, { price: base, sale, ends: r.ends_at ?? null });
        });
      } catch {}
    }

    /* variant_value links */
    const { data: variantValueLinks } = await supabase
      .from("variant_option_values")
      .select("variant_id,option_value_id")
      .in("variant_id", allVariantIds.length ? allVariantIds : ["00000000-0000-0000-0000-000000000000"]);

    const valueIdsByVariant = new Map<string, string[]>();
    (variantValueLinks || []).forEach((row: any) => {
      const arr = valueIdsByVariant.get(row.variant_id) || [];
      arr.push(row.option_value_id);
      valueIdsByVariant.set(row.variant_id, arr);
    });

    /* ====== INVENTORY ====== */
    const qtyByVariant = new Map<string, number>();
    if (allVariantIds.length) {
      const { data: invRows } = await supabase
        .from("variant_inventory")
        .select("variant_id, qty_on_hand, qty_reserved")
        .in("variant_id", allVariantIds);
      (invRows || []).forEach((r: any) => {
        const avail = (r.qty_on_hand ?? 0) - (r.qty_reserved ?? 0);
        if (!Number.isFinite(avail)) return;
        qtyByVariant.set(r.variant_id, (qtyByVariant.get(r.variant_id) ?? 0) + Math.max(avail, 0));
      });
    }
    if (qtyByVariant.size === 0 && allVariantIds.length) {
      const { data: stockRows } = await supabase
        .from("stocks")
        .select("variant_id, qty_on_hand, qty_reserved")
        .in("variant_id", allVariantIds);
      (stockRows || []).forEach((r: any) => {
        const avail = (r.qty_on_hand ?? 0) - (r.qty_reserved ?? 0);
        if (!Number.isFinite(avail)) return;
        qtyByVariant.set(r.variant_id, (qtyByVariant.get(r.variant_id) ?? 0) + Math.max(avail, 0));
      });
    }
    if (qtyByVariant.size === 0 && allVariantIds.length) {
      const { data: txRows } = await supabase
        .from("variant_inventory_transactions")
        .select("variant_id, kind, qty")
        .in("variant_id", allVariantIds);
      const acc = new Map<string, number>();
      (txRows || []).forEach((r: any) => {
        let delta = 0;
        if (r.kind === "in" || r.kind === "return") delta = r.qty ?? 0;
        else if (r.kind === "out") delta = -(r.qty ?? 0);
        else if (r.kind === "adjust") delta = r.qty ?? 0;
        acc.set(r.variant_id, (acc.get(r.variant_id) ?? 0) + delta);
      });
      for (const [vid, q] of acc.entries()) qtyByVariant.set(vid, Math.max(0, q));
    }

    const qtyByValue = new Map<string, number>();
    for (const [variantId, vValueIds] of (valueIdsByVariant || new Map()).entries()) {
      const qv = qtyByVariant.get(variantId) ?? 0;
      if (qv > 0) for (const valId of vValueIds)
        qtyByValue.set(valId, (qtyByValue.get(valId) ?? 0) + qv);
    }

    /* ====== OPTIONS ====== */
    const { data: optionGroups } = await supabase
      .from("product_options")
      .select(
        "id,product_id,name,display_type,type,required,sort_order,description,visibility,visibility_condition_type,visibility_condition_option,visibility_condition_value"
      )
      .in("product_id", productIds)
      .order("product_id", { ascending: true })
      .order("sort_order", { ascending: true });
    const groupIds = (optionGroups || []).map((g: any) => g.id);

    const { data: optionValues } = await supabase
      .from("product_option_values")
      .select(
        "id,option_id,name,display_value,is_default,sort_order,extra_price,image_url,extra_price_currency"
      )
      .in("option_id", groupIds.length ? groupIds : ["00000000-0000-0000-0000-000000000000"])
      .order("option_id", { ascending: true })
      .order("sort_order", { ascending: true });

    /* ====== VALUE PRICING (min across variants) ====== */
    type VMin = { list: number | null; sale: number | null; display: number | null; source: "variant" | "option_extra" };
    const valuePricing = new Map<string, VMin>();
    if (variantValueLinks?.length) {
      const lists = new Map<string, number[]>();
      const sales = new Map<string, number[]>();
      for (const [variantId, vValueIds] of valueIdsByVariant.entries()) {
        const pr = latestByVariant.get(variantId);
        if (!pr) continue;
        const list = typeof pr.price === "number" ? pr.price : null;
        const sale = pr.sale && list && pr.sale < list ? pr.sale : null;
        for (const valId of vValueIds) {
          if (list != null) {
            const a = lists.get(valId) || [];
            a.push(list);
            lists.set(valId, a);
          }
          if (sale != null) {
            const a = sales.get(valId) || [];
            a.push(sale);
            sales.set(valId, a);
          }
        }
      }
      for (const [valId, arr] of lists.entries()) {
        const listMin = Math.min(...arr);
        const saleArr = sales.get(valId);
        const saleMin = saleArr && saleArr.length ? Math.min(...saleArr) : null;
        const display = saleMin != null && saleMin < listMin ? saleMin : listMin;
        valuePricing.set(valId, { list: listMin, sale: saleMin, display, source: "variant" });
      }
    }

    /* build values grouped — لا نُرجع 0 كسعر عند غياب السعر */
    const valuesByGroup = new Map<string, any[]>();
    (optionValues || []).forEach((ov: any) => {
      const fromVar = valuePricing.get(ov.id) || null;
      const list =
        fromVar?.list ??
        (typeof ov.extra_price === "number" && ov.extra_price > 0 ? ov.extra_price : null);
      const sale = fromVar?.sale ?? null;
      const display =
        fromVar?.display ??
        (typeof ov.extra_price === "number" && ov.extra_price > 0 ? ov.extra_price : null);

      const arr = valuesByGroup.get(ov.option_id) || [];
      arr.push({
        id: String(ov.id),
        label: String(ov.name ?? ""),
        value_code: ov.display_value ?? null,
        is_default: !!ov.is_default,
        sort_order: ov.sort_order ?? 0,
        image_url: ov.image_url ?? null,
        extra_price_currency: ov.extra_price_currency ?? "SAR",
        list_price: list,           // ← null إذا ما فيه سعر
        sale_price: sale,           // ← null إذا ما فيه خصم
        display_price: display,     // ← null إذا ما فيه سعر
        extra_price: typeof ov.extra_price === "number" && ov.extra_price > 0 ? ov.extra_price : null,
        qty_total: qtyByValue.get(ov.id) ?? 0,
      });
      valuesByGroup.set(ov.option_id, arr);
    });

    const groupsByProduct = new Map<string, any[]>();
    (optionGroups || []).forEach((g: any) => {
      const arr = groupsByProduct.get(g.product_id) || [];
      arr.push({
        id: String(g.id),
        name: String(g.name ?? ""),
        display_type: g.display_type ?? "text",
        kind: g.type === "radio" ? "choice" : "addon",
        required: !!g.required,
        sort_order: g.sort_order ?? 0,
        description: g.description ?? null,
        visibility: g.visibility ?? "always",
        visibility_condition_type: g.visibility_condition_type ?? null,
        visibility_condition_option: g.visibility_condition_option ?? null,
        visibility_condition_value: g.visibility_condition_value ?? null,
        values: (valuesByGroup.get(g.id) || []).sort(
          (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
        ),
      });
      groupsByProduct.set(g.product_id, arr);
    });

    /* items */
    const items = (products as ProductRow[]).map((p) => {
      const vIds = variantIdsByProduct.get(p.id) || [];
      const mainId = mainVariantByProduct.get(p.id) || null;

      let minDisplay: number | null = null;
      let chosenBase: number | null = null;
      let chosenSale: number | null = null;
      let chosenEnds: string | null = null;

      for (const vid of vIds) {
        const pr = latestByVariant.get(vid);
        if (!pr) continue;
        const base = pr.price;
        const sale = pr.sale;
        const display = sale ?? base;
        if (display == null || display <= 0) continue;
        if (minDisplay == null || display < minDisplay) {
          minDisplay = display;
          chosenBase = base ?? null;
          chosenSale = sale ?? null;
          chosenEnds = pr.ends ?? null;
        }
      }

      if (minDisplay == null && mainId) {
        const pr = latestByVariant.get(mainId) || null;
        if (pr) {
          const base = pr.price;
          const sale = pr.sale;
          const display = sale ?? base;
          if (display != null && display > 0) {
            minDisplay = display;
            chosenBase = base ?? null;
            chosenSale = sale ?? null;
            chosenEnds = pr.ends ?? null;
          }
        }
      }

      // base_price_fallback: أولًا main variant، ثم أرخص متغير صالح، وإلا 0
      const base_price_fallback =
        (chosenBase != null && chosenBase > 0
          ? chosenBase
          : minDisplay != null && minDisplay > 0
          ? minDisplay
          : 0) as number;

      const slugOut =
        p.seo_slug_tpl && p.seo_slug_tpl.trim().length > 0
          ? p.seo_slug_tpl
          : slugify(p.name || p.id);
      const list = chosenBase;
      const sale = chosenSale;
      const hasSale = list != null && sale != null && sale < list;
      const price_canonical = {
        list: Number.isFinite(list as any) && (list as number) > 0 ? (list as number) : 0,
        sale: hasSale ? (sale as number) : null,
        label: hasSale
          ? {
              kind: "sale" as const,
              text: `${Math.round((((list as number) - (sale as number)) / (list as number)) * 100)}% خصم`,
            }
          : vIds.length > 1
          ? { kind: "range" as const, text: `يبدأ من ${minDisplay ?? 0}` }
          : { kind: "single" as const, text: `${list ?? 0}` },
      };

      const variantsOut = vIds.map((vid) => {
        const pr = latestByVariant.get(vid) || null;
        return {
          id: vid,
          sku: (variants as VariantRow[] | null)?.find((x) => x.id === vid)?.sku ?? null,
          status: "active",
          value_ids: valueIdsByVariant.get(vid) || [],
          price: pr?.price ?? null,
          sale_price: pr?.sale && pr?.price && pr.sale < pr.price ? pr.sale : null,
          ends_at: pr?.ends ?? null,
          qty_available: qtyByVariant.get(vid) ?? 0,
        };
      });

      return {
        id: p.id,
        slug: slugOut,
        name: p.name,
        image: primaryByProduct.get(p.id) || null,
        price: list ?? null,
        sale_price: sale ?? null,
        ends_at: chosenEnds ?? null,
        starts_from: vIds.length > 1,
        price_canonical,
        base_price_fallback, // 👈 مضاف
        brand_name: p.brand_id ? brandById.get(p.brand_id) ?? null : null,
        option_groups: (groupsByProduct.get(p.id) || []).sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
        ),
        variants: variantsOut,
      };
    });

    if (slug && items[0]) {
      const pid = items[0].id;
      const { data: gallery } = await supabase
        .from("product_images")
        .select("url,is_primary,sort_order,created_at")
        .eq("product_id", pid)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      const imagesList = (gallery || []).map((g: any) => g?.url).filter(Boolean) as string[];
      (items[0] as any).images = imagesList;
    }

    if (slug)
      return NextResponse.json({
        success: true,
        data: items[0] ?? null,
        page: 1,
        size: 1,
        total: items[0] ? 1 : 0,
      });
    return NextResponse.json({
      success: true,
      data: items,
      page,
      size,
      total: count ?? items.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
