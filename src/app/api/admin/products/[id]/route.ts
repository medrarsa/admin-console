// src/app/api/admin/products/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import createServerSupabase, {
  createServiceRoleSupabase,
} from "@/lib/supabase/server";

/* ========= Utilities ========= */
const ok = (data: any, status = 200) =>
  NextResponse.json({ success: true, status, data }, { status });
const fail = (error: string, status = 400, meta?: any) =>
  NextResponse.json({ success: false, status, error, meta }, { status });

/* ========= Request Body ========= */
type Body = {
  name?: string;
  tags?: string[]; // أسماء وسوم (اختياري)
  brand?: string | null;
  brandId?: string | null;

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

  /* أقسام المنتج */
  taxon_ids?: string[];

  /* استقبال معرفات الوسوم مباشرة من الواجهة بأسلوب سلة */
  tagIds?: string[];

  /* ✅ NEW: حالة المنتج أو سويتش تشغيل/تعطيل */
  status?: "active" | "hidden" | "draft" | "archived" | "sale" | "out";
  toggleActive?: boolean;
};

/* ✅ NEW: مجموعة الحالات المسموحة */
const ALLOWED_STATUS = new Set([
  "active",
  "hidden",
  "draft",
  "archived",
  "sale",
  "out",
]);

/* ========= Small helpers ========= */
async function upsertBrand(db: any, name?: string | null) {
  if (!name?.trim()) return null;
  const { data: f } = await db
    .from("brands")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (f?.id) return f.id;
  const { data: ins, error } = await db
    .from("brands")
    .insert({ name })
    .select("id")
    .single();
  if (error) throw error;
  return ins.id;
}

async function ensureTags(db: any, names: string[] = []) {
  const uniq = Array.from(new Set(names.map((s) => s.trim()).filter(Boolean)));
  if (!uniq.length) return [];
  const { data: ex } = await db.from("tags").select("id,name").in("name", uniq);
  const have = new Map<string, string>(
    (ex || []).map((r: any) => [r.name, r.id])
  );
  const need = uniq.filter((n) => !have.has(n));
  let added: any[] = [];
  if (need.length) {
    const { data: ins } = await db
      .from("tags")
      .insert(need.map((n) => ({ name: n })))
      .select("id,name");
    added = ins || [];
  }
  const all = [...(ex || []), ...added];
  return uniq
    .map((n) => all.find((x: any) => x.name === n)?.id)
    .filter(Boolean);
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
  const { data: byCode } = await db
    .from("branches")
    .select("id")
    .eq("code", code)
    .maybeSingle();
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
  starts_at?: string | null;
  ends_at: string | null;
  created_at: string;
};

type InvRow = {
  variant_id: string;
  qty_on_hand: number | null;
  qty_reserved: number | null;
};

/** نوع بسيط للڤاريِنت لاستخدامه في الواجهة */
type PV = {
  id: string;
  sku?: string | null;
  cost_price?: number | null;
  unlimited_quantity?: boolean | null;
  status?: string | null;
  created_at?: string;
};

/** هل الخصم فعّال الآن؟ */
function isSaleActive(starts_at?: string | null, ends_at?: string | null) {
  const now = new Date();
  if (starts_at && new Date(starts_at) > now) return false;
  if (ends_at && new Date(ends_at) < now) return false;
  return true;
}

/** يحسب السعر النهائي لڤاريِنت واحد */
function resolveVariantFinalPrice(r?: PriceRow | null) {
  if (!r) return null;
  const base =
    typeof r.price === "number" && isFinite(r.price) ? r.price : null;
  const sale =
    typeof r.sale_price === "number" &&
    isFinite(r.sale_price) &&
    r.sale_price! < (base ?? Number.MAX_VALUE) &&
    isSaleActive((r as any).starts_at, r.ends_at)
      ? r.sale_price!
      : null;
  return sale ?? base;
}

/* ========= تجميعة قراءة المنتج (GET) مع تحسين الوسوم + نطاق الأسعار والكمية ========= */
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

  /* الماركة */
  let brand: { id: string; name: string } | null = null;
  if (p.brand_id) {
    const { data: b } = await db
      .from("brands")
      .select("id,name")
      .eq("id", p.brand_id)
      .maybeSingle();
    if (b) brand = { id: b.id, name: b.name };
  }
  if (!brand && p.brand_id) {
    const svc2 = createServiceRoleSupabase();
    const { data: b2 } = await svc2
      .from("brands")
      .select("id,name")
      .eq("id", p.brand_id)
      .maybeSingle();
    if (b2) brand = { id: b2.id, name: b2.name };
  }

  /* الأقسام (نقرأ بالأدوار المرتفعة لضمان عدم تعثر RLS) */
  const svc = createServiceRoleSupabase();
  const { data: pt } = await svc
    .from("product_taxons")
    .select("taxon_id, taxons:taxon_id ( id, name )")
    .eq("product_id", product_id);
  const taxons: { id: string; name: string }[] = (pt ?? [])
    .map((row: any) =>
      row?.taxons?.id ? { id: row.taxons.id, name: row.taxons.name } : null
    )
    .filter(Boolean) as any[];

  /* الفاريِنتس (فعّالة فقط) */
  const { data: variants } = await db
    .from("product_variants")
    .select("id,sku,cost_price,unlimited_quantity,status,created_at")
    .eq("product_id", product_id)
    .order("created_at", { ascending: true });

  const allVariants = (variants || []) as PV[];
  const activeVariants: PV[] = allVariants.filter(
    (v) => (v.status ?? "active") === "active"
  );
  const allVIds: string[] = activeVariants.map((v) => v.id);
  const mainVariantId: string | null =
    activeVariants[0]?.id ?? (await getMainVariantId(db, product_id));
  const optionVariantIds: string[] = allVIds.filter(
    (id) => id !== mainVariantId
  );

  /* الأسعار (آخر سجل لكل ڤاريِنت) */
  const { data: pricesRaw } = allVIds.length
    ? await db
        .from("variant_prices")
        .select(
          "variant_id,price,currency,sale_price,starts_at,ends_at,created_at"
        )
        .in("variant_id", allVIds)
    : { data: [] as PriceRow[] };

  const pricesData = (pricesRaw ?? []) as PriceRow[];
  const latestPriceByVariant = new Map<string, PriceRow>();
  pricesData
    .sort(
      (a: PriceRow, b: PriceRow) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .forEach((r: PriceRow) => {
      if (!latestPriceByVariant.has(r.variant_id))
        latestPriceByVariant.set(r.variant_id, r);
    });

  /* المخزون (تجميع عبر الفروع) */
  const { data: invRaw } = allVIds.length
    ? await db
        .from("variant_inventory")
        .select("variant_id,qty_on_hand,qty_reserved")
        .in("variant_id", allVIds)
    : { data: [] as InvRow[] };

  const invData = (invRaw ?? []) as InvRow[];
  const invByVariant = new Map<string, { on: number; res: number }>();
  invData.forEach((row) => {
    const cur = invByVariant.get(row.variant_id) || { on: 0, res: 0 };
    cur.on += row.qty_on_hand ?? 0;
    cur.res += row.qty_reserved ?? 0;
    invByVariant.set(row.variant_id, cur);
  });

  /* الصور */
  const { data: imagesRaw } = await db
    .from("product_images")
    .select("id,url,alt,is_primary,sort_order,type,video_url,three_d_image_url")
    .eq("product_id", product_id);

  /* القنوات */
  const { data: channelsRaw } = await db
    .from("product_channels")
    .select("channel")
    .eq("product_id", product_id);
  const channels: string[] = (channelsRaw || []).map((c: any) => c.channel);

  /* الوسوم */
  const { data: ptags } = await svc
    .from("product_tags")
    .select("tag:tag_id ( id, name )")
    .eq("product_id", product_id);

  const tags: { id: string; name: string }[] = (ptags ?? [])
    .map((row: any) => (row?.tag?.id && row?.tag?.name ? row.tag : null))
    .filter(Boolean) as any[];

  const tag_ids: string[] = tags.map((t) => t.id);

  /* ======= حساب نطاق الأسعار وإجمالي الكمية من الخيارات فقط ======= */
  const optionFinals: Array<{
    id: string;
    finalPrice: number | null;
    qtyAvail: number;
  }> = optionVariantIds.map((vid) => {
    const pr: PriceRow | null = latestPriceByVariant.get(vid) ?? null;
    const finalPrice = resolveVariantFinalPrice(pr);
    const invAgg = invByVariant.get(vid);
    const qtyAvail = Math.max((invAgg?.on ?? 0) - (invAgg?.res ?? 0), 0);
    return { id: vid, finalPrice, qtyAvail };
  });

  const pricedOptions = optionFinals.filter(
    (x) => typeof x.finalPrice === "number"
  );

  // Fallback الأساسي من الـ main
  let base_price_fallback: number | null = null;
  if (mainVariantId) {
    const { data: prim } = await db
      .from("product_primary_price")
      .select("list_price")
      .eq("variant_id", mainVariantId)
      .maybeSingle();
    if (prim && typeof (prim as any).list_price === "number") {
      base_price_fallback = (prim as any).list_price;
    } else {
      const { data: last } = await db
        .from("variant_prices")
        .select("price,created_at")
        .eq("variant_id", mainVariantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last && typeof (last as any).price === "number") {
        base_price_fallback = (last as any).price;
      }
    }
  }

  // كمية الـ main مجمعة عبر كل الفروع
  let base_qty_fallback = 0;
  if (mainVariantId) {
    const invMain = invByVariant.get(mainVariantId);
    base_qty_fallback = Math.max((invMain?.on ?? 0) - (invMain?.res ?? 0), 0);
  }

  let price_min: number | null = null;
  let price_max: number | null = null;
  const variants_total_qty = optionFinals.reduce(
    (acc, x) => acc + (x.qtyAvail > 0 ? x.qtyAvail : 0),
    0
  );

  if (pricedOptions.length > 0) {
    price_min = Math.min(...pricedOptions.map((x) => x.finalPrice!));
    price_max = Math.max(...pricedOptions.map((x) => x.finalPrice!));
  } else if (typeof base_price_fallback === "number") {
    price_min = base_price_fallback; // min=max عند عدم وجود أسعار خيارات
    price_max = base_price_fallback;
  }

  /* المين ڤاريِنت (للحقول القديمة في البطاقة) */
  const mainV: PV | undefined = activeVariants.find(
    (v: PV) => v.id === mainVariantId
  );
  const mainPrice = mainV ? latestPriceByVariant.get(mainV.id) ?? null : null;
  const mainCost = mainV ? mainV.cost_price ?? null : null;
  const mainSku = mainV ? mainV.sku ?? null : null;
  const quantity = Math.max(base_qty_fallback ?? 0, 0);

  return {
    id: p.id,
    name: p.name,
    type: p.product_type ?? "product",
    status: p.status ?? "active",

    // الحقول القديمة (لا ألمسها)
    price: {
      amount: mainPrice?.price ?? 0,
      currency: (mainPrice?.currency as string) ?? "SAR",
    },
    sale_price:
      mainPrice?.sale_price != null
        ? {
            amount: mainPrice.sale_price,
            currency: (mainPrice?.currency as string) ?? "SAR",
          }
        : null,
    sale_end: mainPrice?.ends_at ?? null,
    main_cost_price: mainCost,
    main_sku: mainSku,
    quantity,

    // الحقول الجديدة
    variants_price_min: price_min,
    variants_price_max: price_max,
    variants_price_label:
      price_min != null && price_max != null
        ? price_min === price_max
          ? `${price_min}`
          : `يبدأ من ${price_min} إلى ${price_max}`
        : null,
    variants_total_qty,
    base_price_fallback,
    base_qty_fallback,

    short_title: p.short_title ?? null,
    years: p.years ?? null,
    description_html: p.description_html ?? null,
    seo_title_tpl: p.seo_title_tpl ?? null,
    seo_slug_tpl: p.seo_slug_tpl ?? null,
    seo_desc_tpl: p.seo_desc_tpl ?? null,

    brand,
    channels,
    taxons,
    tags,
    tag_ids,
    images:
      (imagesRaw as any[] | null | undefined)?.map((im: any) => ({
        id: im.id,
        url: im.url,
        alt: im.alt ?? "",
        main: !!im.is_primary,
        sort: im.sort_order ?? 0,
        type: im.type ?? "image",
        video_url: im.video_url ?? null,
        three_d_image_url: im.three_d_image_url ?? null,
      })) ?? [],

    skus: activeVariants.map((v: PV) => {
      const vp = latestPriceByVariant.get(v.id) as PriceRow | undefined;
      const ivAgg = invByVariant.get(v.id);
      const finalPrice = resolveVariantFinalPrice(vp ?? null);
      return {
        id: v.id,
        sku: v.sku ?? "",
        cost_price: v.cost_price ?? null,
        stock_quantity: Math.max((ivAgg?.on ?? 0) - (ivAgg?.res ?? 0), 0),
        unlimited_quantity: !!v.unlimited_quantity,
        price: { amount: vp?.price ?? 0, currency: vp?.currency ?? "SAR" },
        sale_price:
          vp?.sale_price != null
            ? { amount: vp.sale_price, currency: vp?.currency ?? "SAR" }
            : null,
        ends_at: vp?.ends_at ?? null,
        final_price: finalPrice,
      };
    }),
  };
}

/* ========= GET ========= */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const { id } = await ctx.params;
    const { data: exists, error } = await supabase
      .from("products")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (error) return fail(error.message, 400, { where: "exists/products" });
    if (!exists?.id) return fail("المنتج غير موجود", 404);
    const data = await buildProductDetails(supabase, id);
    return ok(data, 200);
  } catch (err: any) {
    return fail(err?.message || "تعذّر جلب بيانات المنتج", 400);
  }
}

/* ========= PATCH ========= */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabase(); // قراءة عامة
    const admin = createServiceRoleSupabase(); // 🔐 للكتابة

    const { id } = await ctx.params;
    const product_id = id;
    const body = (await req.json()) as Body;

    const { data: exists, error: e0 } = await supabase
      .from("products")
      .select("id")
      .eq("id", product_id)
      .maybeSingle();
    if (e0) return fail(e0.message, 400, { where: "exists/products" });
    if (!exists?.id) return fail("المنتج غير موجود", 404);

    /* ✅ NEW: تبديل التشغيل/التعطيل قبل أي شيء (active ⇄ hidden) */
    if (body.toggleActive === true) {
      const { data: cur } = await supabase
        .from("products")
        .select("status")
        .eq("id", product_id)
        .maybeSingle();

      const current = (cur?.status as string) ?? "active";
      const next = current === "active" ? "hidden" : "active";

      const { error: eToggle } = await admin
        .from("products")
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq("id", product_id);

      if (eToggle)
        return fail(eToggle.message, 400, { where: "update/products/toggle" });
    }

    /* ✅ NEW: تعيين حالة محددة إذا أُرسلت */
    if (typeof body.status === "string") {
      const s = body.status.trim().toLowerCase();
      if (!ALLOWED_STATUS.has(s as any)) {
        return fail(`Invalid status "${body.status}"`, 422, {
          where: "validate/products/status",
        });
      }
      const { error: eStatus } = await admin
        .from("products")
        .update({ status: s, updated_at: new Date().toISOString() })
        .eq("id", product_id);
      if (eStatus)
        return fail(eStatus.message, 400, { where: "update/products/status" });
    }

    /* ✅ 0) الأقسام */
    if (Array.isArray(body.taxon_ids)) {
      const ids = Array.from(
        new Set(
          body.taxon_ids
            .filter((x) => typeof x === "string")
            .map((x) => x.trim())
            .filter((x) => x.length > 0)
        )
      );

      if (ids.length === 0) {
        const { error: delAllErr } = await admin
          .from("product_taxons")
          .delete()
          .eq("product_id", product_id);
        if (delAllErr)
          return fail(delAllErr.message, 400, {
            where: "delete/product_taxons/all",
          });
      } else {
        const { data: currentRows, error: curErr } = await admin
          .from("product_taxons")
          .select("taxon_id")
          .eq("product_id", product_id);
        if (curErr)
          return fail(curErr.message, 400, { where: "select/product_taxons" });

        const current = new Set(
          (currentRows ?? []).map((r: any) => r.taxon_id as string)
        );
        const next = new Set(ids);

        const toDelete = Array.from(current).filter((x) => !next.has(x));
        const toInsert = Array.from(next)
          .filter((x) => !current.has(x))
          .map((taxon_id) => ({ product_id, taxon_id }));

        if (toDelete.length) {
          const { error: delErr } = await admin
            .from("product_taxons")
            .delete()
            .eq("product_id", product_id)
            .in("taxon_id", toDelete);
          if (delErr)
            return fail(delErr.message, 400, {
              where: "delete/product_taxons",
            });
        }

        if (toInsert.length) {
          const { error: insErr } = await admin
            .from("product_taxons")
            .upsert(toInsert, { onConflict: "product_id,taxon_id" });
          if (insErr)
            return fail(insErr.message, 400, {
              where: "upsert/product_taxons",
            });
        }
      }
    }

    // 1) اسم المنتج
    if (typeof body.name === "string") {
      const nm = body.name.trim();
      if (nm.length < 3 || nm.length > 200)
        return fail("اسم المنتج يجب أن يكون بين 3 و 200 حرفًا", 400);
      const { error: upErr } = await admin
        .from("products")
        .update({ name: nm })
        .eq("id", product_id);
      if (upErr)
        return fail(upErr.message, 400, { where: "update/products/name" });
    }

    // 2) SEO/desc + brand
    const prodPatch: Record<string, any> = {};
    if (typeof body.shortTitle !== "undefined")
      prodPatch.short_title = body.shortTitle;
    if (typeof body.years !== "undefined") prodPatch.years = body.years;
    if (typeof body.descriptionHtml !== "undefined")
      prodPatch.description_html = body.descriptionHtml;
    if (typeof body.seoTitleTpl !== "undefined")
      prodPatch.seo_title_tpl = body.seoTitleTpl;
    if (typeof body.seoSlugTpl !== "undefined")
      prodPatch.seo_slug_tpl = body.seoSlugTpl;
    if (typeof body.seoDescTpl !== "undefined")
      prodPatch.seo_desc_tpl = body.seoDescTpl;

    if (typeof body.brandId === "string" && body.brandId?.trim()) {
      prodPatch.brand_id = body.brandId.trim();
    } else if (typeof body.brand !== "undefined") {
      const brand_id = await upsertBrand(admin, body.brand);
      prodPatch.brand_id = brand_id;
    }

    if (Object.keys(prodPatch).length) {
      const { error: e1 } = await admin
        .from("products")
        .update(prodPatch)
        .eq("id", product_id);
      if (e1)
        return fail(e1.message, 400, { where: "update/products/seo+extras" });
    }

    // 3) tags
    if (Array.isArray((body as any).tagIds) || Array.isArray(body.tags)) {
      let tagIds: string[] = [];
      const tagIdsInBody = (body as any).tagIds as string[] | undefined;

      if (Array.isArray(tagIdsInBody) && tagIdsInBody.length) {
        tagIds = Array.from(
          new Set(
            tagIdsInBody.filter(
              (x) => typeof x === "string" && x.trim().length > 0
            )
          )
        );
      } else if (Array.isArray(body.tags) && body.tags.length) {
        const ids = await ensureTags(admin, body.tags);
        tagIds = ids as string[];
      }

      const { error: dErr } = await admin
        .from("product_tags")
        .delete()
        .eq("product_id", product_id);
      if (dErr)
        return fail(dErr.message, 400, { where: "delete/product_tags" });

      if (tagIds.length) {
        const rows = tagIds.map((tag_id) => ({ product_id, tag_id }));
        const { error: iErr } = await admin.from("product_tags").insert(rows);
        if (iErr)
          return fail(iErr.message, 400, { where: "insert/product_tags" });
      }
    }

    // 4) main variant: cost, sku, prices, qty
    const mainVariantId = await getMainVariantId(supabase, product_id);
    if (mainVariantId) {
      if (typeof body.costPrice !== "undefined") {
        const { error: eCost } = await admin
          .from("product_variants")
          .update({ cost_price: body.costPrice })
          .eq("id", mainVariantId);
        if (eCost)
          return fail(eCost.message, 400, {
            where: "update/product_variants/cost_price",
          });
      }

      if (typeof body.sku !== "undefined") {
        const { error: eSku } = await admin
          .from("product_variants")
          .update({ sku: body.sku ?? "" })
          .eq("id", mainVariantId);
        if (eSku)
          return fail(eSku.message, 400, {
            where: "update/product_variants/sku",
          });
      }

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
        if (typeof body.price === "number" && Number.isFinite(body.price))
          upd.price = body.price;
        if (typeof body.salePrice !== "undefined")
          upd.sale_price = body.salePrice ?? null;
        if (typeof body.discountEnd !== "undefined")
          upd.ends_at = body.discountEnd ?? null;

        if (latest?.id) {
          const { error: eP } = await admin
            .from("variant_prices")
            .update(upd)
            .eq("id", latest.id);
          if (eP)
            return fail(eP.message, 400, { where: "update/variant_prices" });
        } else {
          const basePrice = typeof upd.price === "number" ? upd.price : 0;
          const { error: eP2 } = await admin.from("variant_prices").insert({
            variant_id: mainVariantId,
            price: basePrice,
            currency: "SAR",
            price_type: "retail",
            starts_at: new Date().toISOString(),
            sale_price:
              typeof upd.sale_price !== "undefined" ? upd.sale_price : null,
            ends_at: typeof upd.ends_at !== "undefined" ? upd.ends_at : null,
          });
          if (eP2)
            return fail(eP2.message, 400, { where: "insert/variant_prices" });
        }
      }

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
              .update({
                qty_on_hand: body.qty ?? 0,
                updated_at: new Date().toISOString(),
              })
              .eq("id", inv.id);
            if (eInv)
              return fail(eInv.message, 400, {
                where: "update/variant_inventory",
              });
          } else {
            const { error: eInv2 } = await admin
              .from("variant_inventory")
              .insert({
                variant_id: mainVariantId,
                branch_id: branchId,
                qty_on_hand: body.qty ?? 0,
                qty_reserved: 0,
              });
            if (eInv2)
              return fail(eInv2.message, 400, {
                where: "insert/variant_inventory",
              });
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
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabase(); // قراءة/تحقق
    const admin = createServiceRoleSupabase(); // كتابة محمية بـ RLS
    const { id } = await ctx.params;
    const product_id = id;

    const { data: exists, error: e0 } = await supabase
      .from("products")
      .select("id")
      .eq("id", product_id)
      .maybeSingle();
    if (e0) return fail(e0.message, 400, { where: "exists/products" });
    if (!exists?.id) return fail("المنتج غير موجود", 404);

    // احذف التوابع المرتبطة
    await admin.from("product_images").delete().eq("product_id", product_id);
    await admin.from("product_tags").delete().eq("product_id", product_id);
    await admin.from("product_taxons").delete().eq("product_id", product_id);

    const { data: opts } = await supabase
      .from("product_options")
      .select("id")
      .eq("product_id", product_id);
    if (opts?.length) {
      const optIds = opts.map((o) => o.id);
      const { data: vals } = await supabase
        .from("product_option_values")
        .select("id")
        .in("option_id", optIds);
      if (vals?.length) {
        const valIds = vals.map((v) => v.id);
        await admin
          .from("variant_option_values")
          .delete()
          .in("option_value_id", valIds);
        await admin.from("product_option_values").delete().in("id", valIds);
      }
      await admin.from("product_options").delete().in("id", optIds);
    }

    const { data: vars } = await supabase
      .from("product_variants")
      .select("id")
      .eq("product_id", product_id);
    if (vars?.length) {
      const vIds = vars.map((v) => v.id);
      await admin
        .from("variant_inventory_transactions")
        .delete()
        .in("variant_id", vIds);
      await admin.from("variant_inventory").delete().in("variant_id", vIds);
      await admin.from("variant_prices").delete().in("variant_id", vIds);
      await admin.from("variant_option_values").delete().in("variant_id", vIds);
      await admin.from("product_variants").delete().in("id", vIds);
    }

    const { error: delErr } = await admin
      .from("products")
      .delete()
      .eq("id", product_id);
    if (delErr) return fail(delErr.message, 400, { where: "delete/products" });

    return ok({ id: product_id }, 200);
  } catch (err: any) {
    return fail(err?.message || "تعذّر حذف المنتج", 400);
  }
}
