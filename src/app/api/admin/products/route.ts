// src/app/api/admin/products/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import createServerSupabase from "@/lib/supabase/server";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

/* =========================================
   Helpers
   ========================================= */

// يدعم العربية + الأرقام + الشرطة ويمنع الرموز الغريبة
function slugify(val: string) {
  return val
    .toString()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}\-]+/gu, "")
    .replace(/\-+/g, "-");
}

// يضمن تفريد الـSKU بإضافة -01, -02 ... إذا وجدنا تكرارًا
async function ensureUniqueSku(base: string, client: any) {
  let sku = base || "SKU";
  let i = 1;
  while (true) {
    const { data } = await client
      .from("product_variants")
      .select("id")
      .eq("sku", sku)
      .limit(1)
      .maybeSingle();
    if (!data) break;
    i += 1;
    sku = `${base}-${String(i).padStart(2, "0")}`;
  }
  return sku;
}

// جداء ديكارتي لقوائم القيم
function cartesian<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>((acc, curr) => {
    if (acc.length === 0) return curr.map((x) => [x]);
    const out: T[][] = [];
    for (const a of acc) for (const c of curr) out.push([...a, c]);
    return out;
  }, []);
}

/* =========================================
   Zod Schemas
   ========================================= */

const ImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional(),
  is_primary: z.boolean().optional().default(false),
  sort: z.number().int().optional().default(0),
  type: z.enum(["image", "video"]).optional().default("image"),
  video_url: z.string().url().optional(),
  three_d_image_url: z.string().url().optional(),
});

const OptionValueSchema = z.object({
  name: z.string().min(1),
  display_value: z.string().optional(),
  is_default: z.boolean().optional().default(false),
  extra_price: z.number().optional().default(0),
  sort_order: z.number().int().optional().default(0),
});

const OptionSchema = z.object({
  name: z.string().min(1),
  display_type: z.enum(["text", "image", "color"]).default("text"),
  type: z.enum(["radio", "checkbox"]).default("radio"),
  required: z.boolean().default(false),
  sort_order: z.number().int().default(0),
  values: z.array(OptionValueSchema).min(1),
});

const SkuSchema = z.object({
  sku: z.string().min(1).optional(),
  barcode: z.string().optional(),
  mpn: z.string().optional(),
  gtin: z.string().optional(),
  cost_price: z.number().nonnegative().optional(),
  weight: z.number().nonnegative().optional(),
  weight_type: z.enum(["kg", "g", "lb", "oz"]).optional(),

  price: z.number().nonnegative().optional().default(0),
  currency: z.string().min(2).max(3).optional().default("SAR"),
  sale_price: z.number().nonnegative().optional(),
  sale_end: z.string().optional(), // ISO

  unlimited_quantity: z.boolean().optional().default(true),
  qty_on_hand: z.number().int().nonnegative().optional().default(0),

  // اختياري: أسماء قيم الخيارات لربطها بالڤاريِنت مباشرة
  option_values: z.array(z.string()).optional().default([]),
});

const PayloadSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional().default(""),
  status: z.enum(["active", "hidden", "sale", "out"]).optional().default("active"),
  product_type: z
    .enum(["product","group_products","codes","digital","donating","booking","service","food"])
    .optional()
    .default("product"),
  require_shipping: z.boolean().optional().default(true),

  channels: z.array(z.enum(["web", "app"])).optional().default(["web", "app"]),
  brand: z.object({ name: z.string().min(1) }).optional(),
  tags: z.array(z.string().min(1)).optional().default([]),
  categories: z.array(z.string().uuid()).optional().default([]),

  images: z.array(ImageSchema).optional().default([]),

  options: z.array(OptionSchema).optional().default([]),
  skus: z.array(SkuSchema).optional().default([]),
});

/* =========================================
   POST /api/admin/products  — (CREATE) يستخدم Service-Role للكتابة
   ========================================= */

export async function POST(req: NextRequest) {
  try {
    // قراءة/استعلامات بسيطة: نقدر نستخدم عميلك الحالي
    const supabase = await createServerSupabase();
    // الكتابة المحمية (RLS): استخدم Service-Role
    const admin = createServiceRoleSupabase();

    const body = await req.json();
    const payload = PayloadSchema.parse(body);
    const warnings: string[] = [];

    /* 1) إنشاء المنتج */
    const { data: prodIns, error: prodErr } = await admin
      .from("products")
      .insert({
        name: payload.name,
        description: payload.description,
        status: payload.status,
        product_type: payload.product_type,
        require_shipping: payload.require_shipping,
      })
      .select("id")
      .single();
    if (prodErr || !prodIns)
      return NextResponse.json(
        { error: prodErr?.message || "Failed to create product" },
        { status: 400 }
      );

    const productId = prodIns.id as string;

    /* 2) العلامة التجارية (upsert بالاسم) */
    if (payload.brand?.name) {
      const { data: found } = await supabase
        .from("brands")
        .select("id,name")
        .ilike("name", payload.brand.name)
        .maybeSingle();
      let brandId = found?.id as string | undefined;
      if (!brandId) {
        const { data: insBrand, error: brandErr } = await admin
          .from("brands")
          .insert({ name: payload.brand.name })
          .select("id")
          .single();
        if (brandErr) return NextResponse.json({ error: brandErr.message }, { status: 400 });
        brandId = insBrand?.id as string | undefined;
      }
      if (brandId) {
        const { error } = await admin
          .from("products")
          .update({ brand_id: brandId })
          .eq("id", productId);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    /* 3) القنوات */
    if (payload.channels.length) {
      const { error } = await admin.from("product_channels").upsert(
        payload.channels.map((ch) => ({ product_id: productId, channel: ch })),
        { onConflict: "product_id,channel" }
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    /* 4) الوسوم */
    if (payload.tags.length) {
      const tagNames = [...new Set(payload.tags.map((t) => t.trim()))];
      const { data: existing } = await supabase
        .from("tags")
        .select("id,name")
        .in("name", tagNames);
      const existingMap = new Map(
        (existing ?? []).map((t) => [t.name.toLowerCase(), t.id as string])
      );
      const toInsert = tagNames
        .filter((n) => !existingMap.has(n.toLowerCase()))
        .map((name) => ({ name }));
      let inserted: { id: string; name: string }[] = [];
      if (toInsert.length) {
        const { data: ins, error } = await admin
          .from("tags")
          .insert(toInsert)
          .select("id,name");
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        inserted = ins ?? [];
      }
      const allPairs = [...(existing ?? []), ...inserted].map((t) => ({
        product_id: productId,
        tag_id: t.id,
      }));
      if (allPairs.length) {
        const { error } = await admin
          .from("product_tags")
          .upsert(allPairs, { onConflict: "product_id,tag_id" });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    /* 5) التصنيفات (اختياري) */
    if (payload.categories.length) {
      const { error } = await admin.from("product_taxons").upsert(
        payload.categories.map((taxonId) => ({
          product_id: productId,
          taxon_id: taxonId,
        })),
        { onConflict: "product_id,taxon_id" }
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    /* 6) الصور */
    if (payload.images.length) {
      const rows = payload.images.map((img) => ({
        product_id: productId,
        url: img.url,
        alt: img.alt ?? null,
        is_primary: img.is_primary ?? false,
        sort_order: img.sort ?? 0,
        type: img.type ?? "image",
        video_url: img.video_url ?? null,
        three_d_image_url: img.three_d_image_url ?? null,
      }));
      const { error: imgErr } = await admin.from("product_images").insert(rows);
      if (imgErr) return NextResponse.json({ error: imgErr.message }, { status: 400 });
    }

    /* 7) خيارات + قيم (إن وُجدت) */
    let generatedSkus:
      | {
          skuBase: string; // قبل التفريد
          optionValueIds: string[]; // IDs بعد الإدراج
          namesMap: Record<string, string>;
        }[]
      | [] = [];

    if (payload.options.length) {
      // إدراج الخيارات
      const { data: insOpts, error: optErr } = await admin
        .from("product_options")
        .insert(
          payload.options.map((o, idx) => ({
            product_id: productId,
            name: o.name,
            display_type: o.display_type,
            type: o.type,
            required: o.required ?? false,
            sort_order: o.sort_order ?? idx,
          }))
        )
        .select("id,name,sort_order")
        .order("sort_order", { ascending: true });
      if (optErr)
        return NextResponse.json({ error: optErr.message }, { status: 400 });

      // قيم الخيارات
      const idByName = new Map<string, string>();
      insOpts?.forEach((o) => idByName.set(o.name, o.id));

      const valuesRows: any[] = [];
      for (const o of payload.options) {
        const option_id = idByName.get(o.name)!;
        o.values.forEach((v, idx) =>
          valuesRows.push({
            option_id,
            name: v.name,
            display_value: v.display_value ?? null,
            is_default: v.is_default ?? false,
            sort_order: v.sort_order ?? idx,
            extra_price: v.extra_price ?? 0,
          })
        );
      }

      const { data: insVals, error: valErr } = await admin
        .from("product_option_values")
        .insert(valuesRows)
        .select("id, option_id, name");
      if (valErr)
        return NextResponse.json({ error: valErr.message }, { status: 400 });

      // خرّج القيم حسب اسم الخيار
      const optNameById = new Map<string, string>();
      insOpts?.forEach((o) => optNameById.set(o.id, o.name));

      const valueMapByOptName = new Map<string, { id: string; name: string }[]>();
      payload.options.forEach((o) => valueMapByOptName.set(o.name, []));
      insVals?.forEach((v) => {
        const optName = optNameById.get(v.option_id)!;
        valueMapByOptName.get(optName)!.push({ id: v.id, name: v.name });
      });

      // توليد التركيبات
      const arrays = payload.options.map((o) => valueMapByOptName.get(o.name)!);
      const combos = cartesian(arrays); // [[{id,name},{id,name}], ...]
      generatedSkus = combos.map((combo) => {
        const namesMap: Record<string, string> = {};
        payload.options.forEach((o, i) => (namesMap[o.name] = combo[i].name));
        const base = slugify(
          payload.name + "-" + payload.options.map((o, i) => combo[i].name).join("-")
        );
        return {
          skuBase: base || "SKU",
          optionValueIds: combo.map((v) => v.id),
          namesMap,
        };
      });
    }

    /* 8) فرع افتراضي للمخزون */
    let defaultBranchId: string | null = null;
    {
      const { data: branch } = await supabase
        .from("branches")
        .select("id")
        .limit(1)
        .maybeSingle();
      defaultBranchId = branch?.id ?? null;
      if (!defaultBranchId)
        warnings.push("No branches found. Variants will be created without inventory rows.");
    }

    /* 9) إنشاء SKUs */
    const skusInput =
      payload.skus.length > 0
        ? payload.skus.map((s) => ({ ...s, __optionValueIds: [] as string[], __namesMap: {} as Record<string, string> }))
        : generatedSkus.map((g) => ({
            sku: g.skuBase,
            price: 0,
            currency: "SAR",
            unlimited_quantity: true,
            qty_on_hand: 0,
            __optionValueIds: g.optionValueIds,
            __namesMap: g.namesMap,
          }));

    for (const s of skusInput) {
      // SKU النهائي (تفريد)
      const baseSku =
        s.sku && s.sku.trim().length
          ? slugify(s.sku)
          : slugify(
              payload.name + "-" + ((s as any).__namesMap && Object.values((s as any).__namesMap).length
                ? Object.values((s as any).__namesMap).join("-")
                : "SKU")
            );
      const finalSku = await ensureUniqueSku(baseSku, admin);

      // 9.1 variant
      const { data: variant, error: vErr } = await admin
        .from("product_variants")
        .insert({
          product_id: productId,
          sku: finalSku,
          barcode: (s as any).barcode ?? null,
          mpn: (s as any).mpn ?? null,
          gtin: (s as any).gtin ?? null,
          cost_price: (s as any).cost_price ?? null,
          weight: (s as any).weight ?? null,
          weight_type: (s as any).weight_type ?? null,
          unlimited_quantity: (s as any).unlimited_quantity ?? true,
          status: "active",
        })
        .select("id")
        .single();
      if (vErr || !variant)
        return NextResponse.json(
          { error: vErr?.message || "Failed to create variant" },
          { status: 400 }
        );

      const variantId = variant.id as string;

      // 9.2 price
      const priceRow: any = {
        variant_id: variantId,
        price: (s as any).price ?? 0,
        currency: (s as any).currency ?? "SAR",
        price_type: "retail",
        starts_at: new Date().toISOString(),
      };
      if ((s as any).sale_price != null) priceRow.sale_price = (s as any).sale_price;
      if ((s as any).sale_end) priceRow.ends_at = (s as any).sale_end;

      const { error: pErr } = await admin.from("variant_prices").insert(priceRow);
      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

      // 9.3 inventory
      if (defaultBranchId) {
        const invRow = {
          variant_id: variantId,
          branch_id: defaultBranchId,
          qty_on_hand: (s as any).unlimited_quantity ? 0 : (s as any).qty_on_hand ?? 0,
          qty_reserved: 0,
        };
        const { error: iErr } = await admin.from("variant_inventory").insert(invRow);
        if (iErr) return NextResponse.json({ error: iErr.message }, { status: 400 });
      }

      // 9.4 ربط قيم الخيارات
      let optionValueIds: string[] = (s as any).__optionValueIds ?? [];
      if (!optionValueIds.length && (s as any).option_values?.length) {
        const names = (s as any).option_values as string[];
        const { data: rows } = await supabase
          .from("product_option_values")
          .select("id,name")
          .in("name", names);
        optionValueIds = rows?.map((r) => r.id) ?? [];
      }
      if (optionValueIds.length) {
        const { error } = await admin
          .from("variant_option_values")
          .insert(optionValueIds.map((id) => ({ variant_id: variantId, option_value_id: id })));
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    /* 10) إرجاع المنتج مع علاقات أساسية (قراءة عبر anon) */
    const { data: full } = await supabase
      .from("products")
      .select(
        `
        id, name, status, product_type, require_shipping, brand_id,
        product_channels (channel),
        product_tags (tag_id),
        product_taxons (taxon_id),
        product_images (id, url, alt, is_primary, sort_order, type, video_url, three_d_image_url)
      `
      )
      .eq("id", productId)
      .single();

    return NextResponse.json(
      { success: true, data: full, warnings: warnings.length ? warnings : undefined },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unexpected error" }, { status: 500 });
  }
}
