// src/app/api/admin/products/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import createServerSupabase, { createServiceRoleSupabase } from "@/lib/supabase/server";

/* ========= Utilities ========= */
const ok = (data: any, status = 200) =>
  NextResponse.json({ success: true, status, data }, { status });
const fail = (error: string, status = 400, meta?: any) =>
  NextResponse.json({ success: false, status, error, meta }, { status });

/* ========= Request Body ========= */
type Body = {
  name?: string;
  tags?: string[];
  brand?: string | null;     // اسم حر (fallback)
  brandId?: string | null;   // ✅ جديد: حفظ مباشر

  sku?: string | null;
  costPrice?: number | null;
  price?: number | null;
  salePrice?: number | null;
  discountEnd?: string | null;
  qty?: number | null;

  shortTitle?: string | null;
  years?: string | null;
  descriptionHtml?: string | null;
  seoTitleTpl?: string | null;
  seoSlugTpl?: string | null;
  seoDescTpl?: string | null;
};

/* ========= Small helpers ========= */
async function upsertBrand(db: any, name?: string | null) {
  if (!name?.trim()) return null;
  const { data: f } = await db.from("brands").select("id").ilike("name", name).maybeSingle();
  if (f?.id) return f.id;
  const { data: ins, error } = await db.from("brands").insert({ name }).select("id").single();
  if (error) throw error;
  return ins.id;
}

async function ensureTags(db: any, names: string[] = []) {
  const uniq = Array.from(new Set(names.map((s) => s.trim()).filter(Boolean)));
  if (!uniq.length) return [];
  const { data: ex } = await db.from("tags").select("id,name").in("name", uniq);
  const have = new Map((ex || []).map((r: any) => [r.name, r.id]));
  const need = uniq.filter((n) => !have.has(n));
  let added: any[] = [];
  if (need.length) {
    const { data: ins } = await db.from("tags").insert(need.map((n) => ({ name: n }))).select("id,name");
    added = ins || [];
  }
  const all = [...(ex || []), ...added];
  return uniq.map((n) => all.find((x: any) => x.name === n)?.id).filter(Boolean);
}

async function getMainVariantId(db: any, product_id: string) {
  const { data: v } = await db
    .from("product_variants")
    .select("id")
    .eq("product_id", product_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return v?.id ?? null;
}

async function pickBranchId(db: any) {
  const code = process.env.DEFAULT_BRANCH_CODE || "MAIN";
  const { data: byCode } = await db.from("branches").select("id").eq("code", code).maybeSingle();
  if (byCode?.id) return byCode.id;
  const { data: first } = await db
    .from("branches")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return first?.id ?? null;
}

type PriceRow = {
  variant_id: string;
  price: number | null;
  currency: string | null;
  sale_price: number | null;
  ends_at: string | null;
  created_at: string;
};

type InvRow = {
  variant_id: string;
  qty_on_hand: number | null;
  qty_reserved: number | null;
};

async function buildProductDetails(db: any, product_id: string) {
  const { data: p, error: eP } = await db
    .from("products")
    .select(
      "id,name,status,product_type,brand_id,short_title,years,description_html,seo_title_tpl,seo_slug_tpl,seo_desc_tpl"
    )
    .eq("id", product_id)
    .maybeSingle();
  if (eP) throw eP;
  if (!p) throw new Error("المنتج غير موجود");

  let brand: { id: string; name: string } | null = null;
  if (p.brand_id) {
    const { data: b } = await db.from("brands").select("id,name").eq("id", p.brand_id).maybeSingle();
    if (b) brand = { id: b.id, name: b.name };
  }

  const { data: variants } = await db
    .from("product_variants")
    .select("id,sku,cost_price,unlimited_quantity")
    .eq("product_id", product_id);

  const vIds = (variants || []).map((v: any) => v.id);

  const { data: pricesRaw } = vIds.length
    ? await db
        .from("variant_prices")
        .select("variant_id,price,currency,sale_price,ends_at,created_at")
        .in("variant_id", vIds)
    : { data: [] as PriceRow[] };

  const pricesData = (pricesRaw ?? []) as PriceRow[];
  const priceMap = new Map<string, PriceRow>();
  pricesData
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .forEach((r: PriceRow) => {
      if (!priceMap.has(r.variant_id)) priceMap.set(r.variant_id, r);
    });

  const { data: invRaw } = vIds.length
    ? await db
        .from("variant_inventory")
        .select("variant_id,qty_on_hand,qty_reserved")
        .in("variant_id", vIds)
    : { data: [] as InvRow[] };

  const invData = (invRaw ?? []) as InvRow[];
  const invMap = new Map<string, InvRow>();
  invData.forEach((row: InvRow) => {
    if (!invMap.has(row.variant_id)) invMap.set(row.variant_id, row);
  });

  const mainV = (variants || [])[0];
  const mainPrice = mainV ? priceMap.get(mainV.id) : null;
  const mainCost = mainV ? mainV.cost_price ?? null : null;
  const quantity = mainV ? invMap.get(mainV.id)?.qty_on_hand ?? 0 : 0;

  const { data: imagesRaw } = await db
    .from("product_images")
    .select("id,url,alt,is_primary,sort_order,type,video_url,three_d_image_url")
    .eq("product_id", product_id);

  const { data: channelsRaw } = await db.from("product_channels").select("channel").eq("product_id", product_id);
  const channels = (channelsRaw || []).map((c: any) => c.channel);
  const { data: ptRaw } = await db.from("product_tags").select("tag_id").eq("product_id", product_id);
  const tagIds = (ptRaw || []).map((x: any) => x.tag_id);
  let tags: { id: string; name: string }[] = [];
  if (tagIds.length) {
    const { data: tt } = await db.from("tags").select("id,name").in("id", tagIds);
    tags = (tt || []).map((t: any) => ({ id: t.id, name: t.name }));
  }

  return {
    id: p.id,
    name: p.name,
    type: p.product_type ?? "product",
    status: p.status ?? "active",

    price: { amount: mainPrice?.price ?? 0, currency: mainPrice?.currency ?? "SAR" },
    sale_price: { amount: mainPrice?.sale_price ?? 0, currency: mainPrice?.currency ?? "SAR" },
    sale_end: mainPrice?.ends_at ?? null,
    main_cost_price: mainCost,
    quantity,

    short_title: p.short_title ?? null,
    years: p.years ?? null,
    description_html: p.description_html ?? null,
    seo_title_tpl: p.seo_title_tpl ?? null,
    seo_slug_tpl: p.seo_slug_tpl ?? null,
    seo_desc_tpl: p.seo_desc_tpl ?? null,

    brand,
    channels,
    tags,
    images:
      (imagesRaw || []).map((im: any) => ({
        id: im.id,
        url: im.url,
        alt: im.alt ?? "",
        main: !!im.is_primary,
        sort: im.sort_order ?? 0,
        type: im.type ?? "image",
        video_url: im.video_url ?? null,
        three_d_image_url: im.three_d_image_url ?? null,
      })) ?? [],

    skus: (variants || []).map((v: any) => {
      const vp = priceMap.get(v.id) as PriceRow | undefined;
      const iv = invMap.get(v.id) as InvRow | undefined;
      return {
        id: v.id,
        sku: v.sku ?? "",
        cost_price: v.cost_price ?? null,
        stock_quantity: iv?.qty_on_hand ?? 0,
        unlimited_quantity: !!v.unlimited_quantity,
        price: { amount: vp?.price ?? 0, currency: vp?.currency ?? "SAR" },
        sale_price: { amount: vp?.sale_price ?? 0, currency: vp?.currency ?? "SAR" },
        ends_at: vp?.ends_at ?? null,
      };
    }),
  };
}

/* ========= GET ========= */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerSupabase();
    const { id } = await ctx.params;
    const { data: exists, error } = await supabase.from("products").select("id").eq("id", id).maybeSingle();
    if (error) return fail(error.message, 400, { where: "exists/products" });
    if (!exists?.id) return fail("المنتج غير موجود", 404);
    const data = await buildProductDetails(supabase, id);
    return ok(data, 200);
  } catch (err: any) {
    return fail(err?.message || "تعذّر جلب بيانات المنتج", 400);
  }
}

/* ========= PATCH ========= */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerSupabase();      // قراءة
    const admin = createServiceRoleSupabase();          // كتابة محمية بـ RLS

    const { id } = await ctx.params;
    const product_id = id;
    const body = (await req.json()) as Body;

    const { data: exists, error: e0 } = await supabase.from("products").select("id").eq("id", product_id).maybeSingle();
    if (e0) return fail(e0.message, 400, { where: "exists/products" });
    if (!exists?.id) return fail("المنتج غير موجود", 404);

    // 1) اسم المنتج
    if (typeof body.name === "string") {
      const nm = body.name.trim();
      if (nm.length < 3 || nm.length > 200) return fail("اسم المنتج يجب أن يكون بين 3 و 200 حرفًا", 400);
      const { error: upErr } = await admin.from("products").update({ name: nm }).eq("id", product_id);
      if (upErr) return fail(upErr.message, 400, { where: "update/products/name" });
    }

    // 2) SEO/desc + brand
    const prodPatch: Record<string, any> = {};
    if (typeof body.shortTitle      !== "undefined") prodPatch.short_title      = body.shortTitle;
    if (typeof body.years           !== "undefined") prodPatch.years            = body.years;
    if (typeof body.descriptionHtml !== "undefined") prodPatch.description_html = body.descriptionHtml;
    if (typeof body.seoTitleTpl     !== "undefined") prodPatch.seo_title_tpl    = body.seoTitleTpl;
    if (typeof body.seoSlugTpl      !== "undefined") prodPatch.seo_slug_tpl     = body.seoSlugTpl;
    if (typeof body.seoDescTpl      !== "undefined") prodPatch.seo_desc_tpl     = body.seoDescTpl;

    // ✅ brandId المباشر أولًا (إن أُرسل)
    if (typeof body.brandId === "string" && body.brandId?.trim()) {
      prodPatch.brand_id = body.brandId.trim();
    } else if (typeof body.brand !== "undefined") {
      // fallback: اسم ماركة (upsert)
      const brand_id = await upsertBrand(admin, body.brand);
      prodPatch.brand_id = brand_id;
    }

    if (Object.keys(prodPatch).length) {
      const { error: e1 } = await admin.from("products").update(prodPatch).eq("id", product_id);
      if (e1) return fail(e1.message, 400, { where: "update/products/seo+extras" });
    }

    // 3) tags
    if (Array.isArray(body.tags)) {
      const tagIds = await ensureTags(admin, body.tags);
      const { error: dErr } = await admin.from("product_tags").delete().eq("product_id", product_id);
      if (dErr) return fail(dErr.message, 400, { where: "delete/product_tags" });
      if (tagIds.length) {
        const rows = tagIds.map((tag_id) => ({ product_id, tag_id }));
        const { error: iErr } = await admin.from("product_tags").insert(rows);
        if (iErr) return fail(iErr.message, 400, { where: "insert/product_tags" });
      }
    }

    // 4) main variant: cost, sku, prices, qty
    const mainVariantId = await getMainVariantId(supabase, product_id);
    if (mainVariantId) {
      // cost_price
      if (typeof body.costPrice !== "undefined") {
        const { error: eCost } = await admin
          .from("product_variants")
          .update({ cost_price: body.costPrice })
          .eq("id", mainVariantId);
        if (eCost) return fail(eCost.message, 400, { where: "update/product_variants/cost_price" });
      }

      // sku
      if (typeof body.sku !== "undefined") {
        const { error: eSku } = await admin
          .from("product_variants")
          .update({ sku: body.sku ?? "" })
          .eq("id", mainVariantId);
        if (eSku) return fail(eSku.message, 400, { where: "update/product_variants/sku" });
      }

      // prices
      if (
        typeof body.price !== "undefined" ||
        typeof body.salePrice !== "undefined" ||
        typeof body.discountEnd !== "undefined"
      ) {
        const { data: latest } = await supabase
          .from("variant_prices")
          .select("id,price")
          .eq("variant_id", mainVariantId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const upd: any = { currency: "SAR" };
        if (typeof body.price === "number" && Number.isFinite(body.price)) upd.price = body.price;
        if (typeof body.salePrice !== "undefined") upd.sale_price = body.salePrice ?? null;
        if (typeof body.discountEnd !== "undefined") upd.ends_at = body.discountEnd ?? null;

        if (latest?.id) {
          const { error: eP } = await admin.from("variant_prices").update(upd).eq("id", latest.id);
          if (eP) return fail(eP.message, 400, { where: "update/variant_prices" });
        } else {
          const basePrice = typeof upd.price === "number" ? upd.price : 0;
          const { error: eP2 } = await admin.from("variant_prices").insert({
            variant_id: mainVariantId,
            price: basePrice,
            currency: "SAR",
            price_type: "retail",
            starts_at: new Date().toISOString(),
            sale_price: typeof upd.sale_price !== "undefined" ? upd.sale_price : null,
            ends_at: typeof upd.ends_at !== "undefined" ? upd.ends_at : null,
          });
          if (eP2) return fail(eP2.message, 400, { where: "insert/variant_prices" });
        }
      }

      // qty (لفرع MAIN)
      if (typeof body.qty !== "undefined") {
        const branchId = await pickBranchId(supabase);
        if (branchId) {
          const { data: inv } = await supabase
            .from("variant_inventory")
            .select("id")
            .eq("variant_id", mainVariantId)
            .eq("branch_id", branchId)
            .maybeSingle();

          if (inv?.id) {
            const { error: eInv } = await admin
              .from("variant_inventory")
              .update({ qty_on_hand: body.qty ?? 0, updated_at: new Date().toISOString() })
              .eq("id", inv.id);
            if (eInv) return fail(eInv.message, 400, { where: "update/variant_inventory" });
          } else {
            const { error: eInv2 } = await admin.from("variant_inventory").insert({
              variant_id: mainVariantId,
              branch_id: branchId,
              qty_on_hand: body.qty ?? 0,
              qty_reserved: 0,
            });
            if (eInv2) return fail(eInv2.message, 400, { where: "insert/variant_inventory" });
          }
        }
      }
    }

    const data = await buildProductDetails(supabase, product_id);
    return ok(data, 200);
  } catch (err: any) {
    return fail(err?.message || "تعذّر تحديث المنتج", 400);
  }
}

/* ========= DELETE ========= */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerSupabase();      // قراءة/تحقق
    const admin = createServiceRoleSupabase();          // كتابة محمية بـ RLS
    const { id } = await ctx.params;
    const product_id = id;

    // وجود المنتج
    const { data: exists, error: e0 } = await supabase
      .from("products").select("id").eq("id", product_id).maybeSingle();
    if (e0) return fail(e0.message, 400, { where: "exists/products" });
    if (!exists?.id) return fail("المنتج غير موجود", 404);

    // 1) صور
    await admin.from("product_images").delete().eq("product_id", product_id);

    // 2) وسوم وتصنيفات
    await admin.from("product_tags").delete().eq("product_id", product_id);
    await admin.from("product_taxons").delete().eq("product_id", product_id);

    // 3) خيارات وقيمها + ربطها مع الفاريِنتات
    const { data: opts } = await supabase
      .from("product_options").select("id").eq("product_id", product_id);
    if (opts?.length) {
      const optIds = opts.map(o => o.id);
      const { data: vals } = await supabase
        .from("product_option_values").select("id").in("option_id", optIds);
      if (vals?.length) {
        const valIds = vals.map(v => v.id);
        await admin.from("variant_option_values").delete().in("option_value_id", valIds);
        await admin.from("product_option_values").delete().in("id", valIds);
      }
      await admin.from("product_options").delete().in("id", optIds);
    }

    // 4) الفاريِنتات وأسعارها ومخزونها
    const { data: vars } = await supabase
      .from("product_variants").select("id").eq("product_id", product_id);
    if (vars?.length) {
      const vIds = vars.map(v => v.id);

      // ✅ احذف معاملات المخزون أولاً لحلّ FK
      await admin.from("variant_inventory_transactions").delete().in("variant_id", vIds);

      await admin.from("variant_inventory").delete().in("variant_id", vIds);
      await admin.from("variant_prices").delete().in("variant_id", vIds);
      await admin.from("variant_option_values").delete().in("variant_id", vIds);
      await admin.from("product_variants").delete().in("id", vIds);
    }

    // 5) أخيرًا: المنتج
    const { error: delErr } = await admin.from("products").delete().eq("id", product_id);
    if (delErr) return fail(delErr.message, 400, { where: "delete/products" });

    return ok({ id: product_id }, 200);
  } catch (err: any) {
    return fail(err?.message || "تعذّر حذف المنتج", 400);
  }
}
