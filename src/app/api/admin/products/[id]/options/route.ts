// src/app/api/admin/products/[id]/options/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

/* ========== Schemas ========== */
const ValueSchema = z.object({
  id: z.string().min(1), // UI value id
  label: z.string().min(1),
  colorHex: z.string().optional(),
  imageUrl: z.string().url().optional(),
});
const GroupSchema = z.object({
  id: z.string().min(1), // UI group id
  type: z.enum(["text", "color", "image"]),
  name: z.string().min(1),
  values: z.array(ValueSchema),
});
const VariantSchema = z.object({
  id: z.string().min(1), // UI variant id
  optionValueIds: z.array(z.string().min(1)).nonempty(), // UI value ids
  sku: z.string().optional().nullable(),
  qty: z.number().int().min(0).default(0),
  // السعر/سعر التخفيض قد يأتيان كنص أو رقم
  price: z.union([z.number(), z.string()]).optional(),
  salePrice: z.union([z.number(), z.string()]).optional(),
});
const PatchBody = z.object({
  optionsEnabled: z.boolean().optional(),
  groups: z.array(GroupSchema),
  variants: z.array(VariantSchema),
  branchId: z.string().uuid().optional(),
  removedGroupIds: z.array(z.string().min(1)).optional().default([]),
});

/* ========== Helpers ========== */
const ok = (body: any, status = 200) =>
  NextResponse.json({ status, success: true, ...body }, { status });
const fail = (message: string, detail?: any, status = 500) =>
  NextResponse.json({ status, success: false, message, detail }, { status });

function displayTypeOf(t: "text" | "color" | "image") {
  return t;
}

async function getOrFirstBranchId(
  supabase: SupabaseClient,
  preferred?: string | null
) {
  if (preferred) return preferred;
  const { data, error } = await supabase
    .from("branches")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  if (!data?.length) throw new Error("No branches found");
  return data[0].id as string;
}
function autoSku(productId: string, index: number) {
  const short = productId.replace(/-/g, "").slice(0, 4);
  return `PRD-${short}-${index + 1}`;
}
function uniqueSuffix(i: number) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (i < A.length) return "-" + A[i];
  const q = Math.floor(i / A.length),
    r = i % A.length;
  return "-" + A[r] + q;
}
function ensureUniqueSku(base: string, taken: Set<string>) {
  let c = base,
    i = 0;
  while (taken.has(c)) c = base + uniqueSuffix(i++);
  taken.add(c);
  return c;
}

/* ========== GET ========== */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await ctx.params;
  if (!productId) return fail("Missing product id", null, 400);

  const supabase = createServiceRoleSupabase();

  // المجموعات
  const { data: optGroups, error: gErr } = await supabase
    .from("product_options")
    .select("id, name, display_type, sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });
  if (gErr) return fail("options.load", gErr.message);

  const groupIds = (optGroups ?? []).map((g) => g.id);

  // القيم
  let valuesByGroup = new Map<string, any[]>();
  if (groupIds.length) {
    const { data: vals, error: vErr } = await supabase
      .from("product_option_values")
      .select("id, option_id, name, display_value, image_url, sort_order")
      .in("option_id", groupIds)
      .order("sort_order", { ascending: true });
    if (vErr) return fail("option_values.load", vErr.message);

    valuesByGroup = groupIds.reduce((m, gid) => {
      const g = optGroups?.find((x) => x.id === gid);
      m.set(
        gid,
        (vals ?? [])
          .filter((v) => v.option_id === gid)
          .map((v) => ({
            id: v.id, // DB value id
            label: v.name,
            colorHex:
              g?.display_type === "color"
                ? v.display_value ?? undefined
                : undefined,
            imageUrl:
              g?.display_type === "image"
                ? v.image_url ?? undefined
                : undefined,
          }))
      );
      return m;
    }, new Map<string, any[]>());
  }

  // المتغيرات
  const { data: vars, error: varErr } = await supabase
    .from("product_variants")
    .select("id, sku, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: true });
  if (varErr) return fail("variants.load", varErr.message);

  const variantIds = (vars ?? []).map((v) => v.id);

  // روابط القيم للمتغيرات
  let byVariantVals = new Map<string, string[]>();
  if (variantIds.length) {
    const { data: links, error: lErr } = await supabase
      .from("variant_option_values")
      .select("variant_id, option_value_id")
      .in("variant_id", variantIds);
    if (lErr) return fail("links.load", lErr.message);
    for (const l of links ?? []) {
      const arr = byVariantVals.get(l.variant_id) ?? [];
      arr.push(l.option_value_id);
      byVariantVals.set(l.variant_id, arr);
    }
  }

  // الكميات
  let qtyByVariant = new Map<string, number>();
  if (variantIds.length) {
    const { data: inv } = await supabase
      .from("variant_inventory")
      .select("variant_id, qty_on_hand");
    inv?.forEach((r) => {
      qtyByVariant.set(
        r.variant_id,
        (qtyByVariant.get(r.variant_id) ?? 0) + (r.qty_on_hand ?? 0)
      );
    });
  }

  // آخر سعر retail (سعر عادي + خصم إن وُجد)
  let priceByVariant = new Map<
    string,
    { price: number; sale_price: number | null; created_at: string }
  >();
  if (variantIds.length) {
    const { data: allPrices, error: pErr } = await supabase
      .from("variant_prices")
      .select("variant_id, price, sale_price, created_at, price_type")
      .in("variant_id", variantIds)
      .eq("price_type", "retail");
    if (pErr) return fail("prices.load", pErr.message);

    const latest = new Map<
      string,
      { price: number; sale_price: number | null; created_at: string }
    >();
    for (const p of allPrices ?? []) {
      const prev = latest.get(p.variant_id);
      if (!prev || new Date(p.created_at) > new Date(prev.created_at)) {
        latest.set(p.variant_id, {
          price: Number(p.price),
          sale_price: p.sale_price == null ? null : Number(p.sale_price),
          created_at: p.created_at,
        });
      }
    }
    for (const [vid, obj] of latest.entries()) priceByVariant.set(vid, obj);
  }

  const groups = (optGroups ?? []).map((g) => ({
    id: g.id,
    type: (g.display_type as "text" | "color" | "image") ?? "text",
    name: g.name,
    values: valuesByGroup.get(g.id) ?? [],
  }));

  const variantsResp = (vars ?? []).map((v) => {
    const p = priceByVariant.get(v.id);
    return {
      id: v.id,
      optionValueIds: byVariantVals.get(v.id) ?? [],
      sku: v.sku ?? "",
      qty: qtyByVariant.get(v.id) ?? 0,
      price: p?.price ?? null,
      salePrice: p?.sale_price ?? null,
    };
  });

  const optionsEnabled =
    groups.length > 0 &&
    groups.some((g) => g.values.length > 0) &&
    variantsResp.length > 0;

  return ok({ success: true, optionsEnabled, groups, variants: variantsResp });
}

/* ========== PATCH ========== */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await ctx.params;
  if (!productId) return fail("Missing product id", null, 400);

  const raw = await req.json();
  if (typeof raw?.groups === "string") {
    try {
      raw.groups = JSON.parse(raw.groups);
    } catch {
      return fail("Invalid groups format (string not JSON)", null, 400);
    }
  }

  const parsed = PatchBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        formErrors: [],
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const {
    optionsEnabled,
    groups,
    variants,
    branchId: preferredBranch,
    removedGroupIds = [],
  } = parsed.data;
  const supabase = createServiceRoleSupabase();

  try {
    const resolvedBranchId = await getOrFirstBranchId(
      supabase,
      preferredBranch ?? null
    );

    /* ---- حذف مجموعات محددة (حذف نهائي) ---- */
    if (removedGroupIds.length) {
      const { data: valsOfGroups } = await supabase
        .from("product_option_values")
        .select("id")
        .in("option_id", removedGroupIds);
      const valIds = (valsOfGroups ?? []).map((v) => v.id);

      if (valIds.length)
        await supabase
          .from("variant_option_values")
          .delete()
          .in("option_value_id", valIds);
      if (valIds.length)
        await supabase.from("product_option_values").delete().in("id", valIds);

      await supabase.from("product_options").delete().in("id", removedGroupIds);

      // نظّف المتغيرات التي أصبحت بلا روابط
      const { data: allVars } = await supabase
        .from("product_variants")
        .select("id, created_at")
        .eq("product_id", productId)
        .order("created_at", { ascending: true });

      const vIdsAll = (allVars ?? []).map((v) => v.id);
      if (vIdsAll.length) {
        const { data: stillLinked } = await supabase
          .from("variant_option_values")
          .select("variant_id")
          .in("variant_id", vIdsAll);
        const linkedSet = new Set((stillLinked ?? []).map((r) => r.variant_id));
        const variantsWithoutLinks = vIdsAll.filter((id) => !linkedSet.has(id));

        if (variantsWithoutLinks.length) {
          // لا نحذف آخر/كل المتغيرات بالكامل: أبقِ أقدم واحد كـ main
          const remainingIds = (allVars ?? []).map((r) => r.id);
          const willDeleteAll =
            variantsWithoutLinks.length === remainingIds.length;

          let toDelete = variantsWithoutLinks;
          if (willDeleteAll && remainingIds.length > 0) {
            const keepId = remainingIds[0];
            toDelete = variantsWithoutLinks.filter((id) => id !== keepId);
          }

          if (toDelete.length) {
            await supabase
              .from("variant_inventory_transactions")
              .delete()
              .in("variant_id", toDelete);
            await supabase
              .from("variant_inventory")
              .delete()
              .in("variant_id", toDelete);
            await supabase
              .from("variant_prices")
              .delete()
              .in("variant_id", toDelete);
            await supabase
              .from("variant_option_values")
              .delete()
              .in("variant_id", toDelete);
            await supabase.from("product_variants").delete().in("id", toDelete);
          }
        }
      }
    }

    /* ---- حذف كلي إذا لا توجد مجموعات/متغيرات بالطلب ---- */
    const removingAll = groups.length === 0 && variants.length === 0;
    if (removingAll) {
      // أبقِ أقدم Variant كـ main، واحذف الباقي + نظّف كل الخيارات/القيم/الروابط
      const { data: allVars } = await supabase
        .from("product_variants")
        .select("id, created_at")
        .eq("product_id", productId)
        .order("created_at", { ascending: true });

      const allVarIds = (allVars ?? []).map((v) => v.id);

      if (allVarIds.length) {
        const mainId = allVarIds[0];
        const toDelete = allVarIds.slice(1);

        if (toDelete.length) {
          await supabase
            .from("variant_option_values")
            .delete()
            .in("variant_id", toDelete);
          await supabase
            .from("variant_inventory_transactions")
            .delete()
            .in("variant_id", toDelete);
          await supabase
            .from("variant_inventory")
            .delete()
            .in("variant_id", toDelete);
          await supabase
            .from("variant_prices")
            .delete()
            .in("variant_id", toDelete);
          await supabase.from("product_variants").delete().in("id", toDelete);
        }

        // نظف جميع الخيارات والقيم
        const { data: optIds } = await supabase
          .from("product_options")
          .select("id")
          .eq("product_id", productId);
        const oids = (optIds ?? []).map((o) => o.id);
        if (oids.length) {
          const { data: valIds } = await supabase
            .from("product_option_values")
            .select("id")
            .in("option_id", oids);
          const vids = (valIds ?? []).map((v) => v.id);
          if (vids.length) {
            await supabase
              .from("variant_option_values")
              .delete()
              .in("option_value_id", vids);
            await supabase
              .from("product_option_values")
              .delete()
              .in("id", vids);
          }
          await supabase.from("product_options").delete().in("id", oids);
        }
      } else {
        // لا يوجد أي Variant أصلًا — فقط نظف الخيارات والقيم إن وجدت
        const { data: optIds } = await supabase
          .from("product_options")
          .select("id")
          .eq("product_id", productId);
        const oids = (optIds ?? []).map((o) => o.id);
        if (oids.length) {
          const { data: valIds } = await supabase
            .from("product_option_values")
            .select("id")
            .in("option_id", oids);
          const vids = (valIds ?? []).map((v) => v.id);
          if (vids.length) {
            await supabase
              .from("variant_option_values")
              .delete()
              .in("option_value_id", vids);
            await supabase
              .from("product_option_values")
              .delete()
              .in("id", vids);
          }
          await supabase.from("product_options").delete().in("id", oids);
        }
      }

      return ok({
        message: "Options removed. Preserved main variant & its pricing.",
        optionsEnabled: false,
        groups: [],
        variants: [],
      });
    }

    /* ---- مصالحة عادية ---- */
    const usableGroups = groups.filter((g) => g.values.length > 0);

    // 1) خيارات المنتج (upsert)
    const { data: existingOptions } = await supabase
      .from("product_options")
      .select("id, name, display_type")
      .eq("product_id", productId);

    const optionIdMap = new Map<string, string>(); // UI group id -> DB option id
    for (let idx = 0; idx < usableGroups.length; idx++) {
      const g = usableGroups[idx];
      let dbId = (existingOptions ?? []).find((o) => o.id === g.id)?.id;
      if (!dbId) {
        const { data, error } = await supabase
          .from("product_options")
          .insert({
            id: g.id,
            product_id: productId,
            name: g.name,
            display_type: displayTypeOf(g.type),
            type: "radio",
            sort_order: idx,
            visibility: "always",
            associated_with_order_time: false,
            not_same_day_order: false,
          })
          .select("id")
          .single();
        if (error) throw new Error(`options.insert: ${error.message}`);
        dbId = data!.id;
      } else {
        const { error } = await supabase
          .from("product_options")
          .update({
            name: g.name,
            display_type: displayTypeOf(g.type),
            sort_order: idx,
          })
          .eq("id", dbId);
        if (error) throw new Error(`options.update: ${error.message}`);
      }
      optionIdMap.set(g.id, dbId!);
    }

    // 2) قيم الخيارات (upsert)
    const { data: exVals } = await supabase
      .from("product_option_values")
      .select("id, option_id");

    const valueIdMap = new Map<string, string>();
    const desiredValueIds = new Set<string>();

    for (const g of usableGroups) {
      const dbOptionId = optionIdMap.get(g.id)!;
      for (let vidx = 0; vidx < g.values.length; vidx++) {
        const v = g.values[vidx];
        let dbValId = exVals?.find(
          (ev) => ev.id === v.id && ev.option_id === dbOptionId
        )?.id;

        const display_value =
          g.type === "color"
            ? v.colorHex ?? null
            : g.type === "image"
            ? v.imageUrl ?? null
            : null;

        if (!dbValId) {
          const { data, error } = await supabase
            .from("product_option_values")
            .insert({
              id: v.id,
              option_id: dbOptionId,
              name: v.label,
              display_value,
              image_url: g.type === "image" ? v.imageUrl ?? null : null,
              sort_order: vidx,
              is_default: false,
              extra_price: 0,
              extra_price_currency: "SAR",
            })
            .select("id")
            .single();
          if (error) throw new Error(`option_values.insert: ${error.message}`);
          dbValId = data!.id;
        } else {
          const { error } = await supabase
            .from("product_option_values")
            .update({
              name: v.label,
              display_value,
              image_url: g.type === "image" ? v.imageUrl ?? null : null,
              sort_order: vidx,
            })
            .eq("id", dbValId);
          if (error) throw new Error(`option_values.update: ${error.message}`);
        }

        valueIdMap.set(v.id, dbValId!);
        desiredValueIds.add(v.id);
      }
    }

    // 3) المتغيرات + الروابط + المخزون + الأسعار
    const { data: existingVariants } = await supabase
      .from("product_variants")
      .select("id, sku")
      .eq("product_id", productId);

    const takenSkus = new Set<string>(
      (existingVariants ?? [])
        .map((v) => (v.sku || "").trim())
        .filter((s) => s.length > 0)
    );

    const normalized = variants.map((v, i) => {
      const base =
        v.sku && v.sku.trim().length >= 3
          ? v.sku.trim()
          : autoSku(productId, i);
      const sku = ensureUniqueSku(base, takenSkus);

      const rawPrice = (v as any)?.price;
      const rawSale = (v as any)?.salePrice;

      const priceNum =
        typeof rawPrice === "string"
          ? Number(rawPrice.trim())
          : typeof rawPrice === "number"
          ? rawPrice
          : NaN;

      const saleNum =
        typeof rawSale === "string"
          ? Number(rawSale.trim())
          : typeof rawSale === "number"
          ? rawSale
          : NaN;

      return {
        ...v,
        sku,
        __priceNum: Number.isNaN(priceNum) ? null : Number(priceNum),
        __saleNum: Number.isNaN(saleNum) ? null : Number(saleNum),
      };
    });

    const desiredVariantIds = new Set<string>();

    for (const v of normalized) {
      // حوّل UI value ids إلى DB ids
      const dbValueIds = (v.optionValueIds || [])
        .map((id) => valueIdMap.get(id))
        .filter(Boolean) as string[];
      if (dbValueIds.length === 0) continue;

      // variant row
      let dbVarId = existingVariants?.find((ev) => ev.id === v.id)?.id;
      if (!dbVarId) {
        const { data, error } = await supabase
          .from("product_variants")
          .insert({
            id: v.id,
            product_id: productId,
            sku: v.sku!,
            status: "active",
          })
          .select("id")
          .single();
        if (error) throw new Error(`variants.insert: ${error.message}`);
        dbVarId = data!.id;
      } else {
        const { error } = await supabase
          .from("product_variants")
          .update({ sku: v.sku! })
          .eq("id", dbVarId);
        if (error) throw new Error(`variants.update: ${error.message}`);
      }
      desiredVariantIds.add(v.id);

      // الروابط: امسح ثم أعد الربط
      await supabase
        .from("variant_option_values")
        .delete()
        .eq("variant_id", v.id);
      for (const dbValId of dbValueIds) {
        const { error } = await supabase
          .from("variant_option_values")
          .insert({ variant_id: v.id, option_value_id: dbValId });
        if (error) throw new Error(`links.insert: ${error.message}`);
      }

      // المخزون (upsert)
      const { data: inv } = await supabase
        .from("variant_inventory")
        .select("id")
        .eq("variant_id", v.id)
        .eq("branch_id", resolvedBranchId)
        .maybeSingle();
      if (!inv) {
        await supabase.from("variant_inventory").insert({
          variant_id: v.id,
          branch_id: resolvedBranchId,
          qty_on_hand: (v as any)?.qty ?? 0,
          qty_reserved: 0,
        });
      } else {
        await supabase
          .from("variant_inventory")
          .update({ qty_on_hand: (v as any)?.qty ?? 0 })
          .eq("id", inv.id);
      }

      // الأسعار (price + salePrice) — بدون نطاق تواريخ
      const hasPrice = v.__priceNum != null;
      const hasSale = v.__saleNum != null;

      if (!hasPrice && !hasSale) {
        // لا شيء جديد → لا نلمس الأسعار
      } else {
        if (hasSale && hasPrice && v.__saleNum! >= v.__priceNum!) {
          return fail(
            "sale_price must be less than price",
            { variant_id: v.id },
            400
          );
        }
        if (hasSale && v.__saleNum! <= 0) {
          return fail("sale_price must be > 0", { variant_id: v.id }, 400);
        }

        // احصل على آخر سعر سابق لاستخدامه عند غياب price الجديد
        const { data: last } = await supabase
          .from("variant_prices")
          .select("price")
          .eq("variant_id", v.id)
          .eq("price_type", "retail")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const basePrice =
          (hasPrice ? v.__priceNum! : undefined) ??
          (last ? Number(last.price) : undefined) ??
          (hasSale ? v.__saleNum! : 0);

        const priceInsert: any = {
          variant_id: v.id,
          price: basePrice,
          currency: "SAR",
          price_type: "retail",
        };
        if (hasSale) priceInsert.sale_price = v.__saleNum!;

        const { error: insErr } = await supabase
          .from("variant_prices")
          .insert(priceInsert);
        if (insErr) throw new Error(`variant_prices.insert: ${insErr.message}`);
      }
    }

    // تنظيف المتغيرات اليتيمة (التي لم تعد مطلوبة)
    const orphanVariants = (existingVariants ?? [])
      .map((v) => v.id)
      .filter((id) => !desiredVariantIds.has(id));
    if (orphanVariants.length) {
      // إن كنا سنحذفها كلها، أبقِ الأقدم
      const { data: allAfter } = await supabase
        .from("product_variants")
        .select("id, created_at")
        .eq("product_id", productId)
        .order("created_at", { ascending: true });
      const remainingIds = (allAfter ?? []).map((r) => r.id);
      const willDeleteAll = orphanVariants.length === remainingIds.length;

      let toDelete = orphanVariants;
      if (willDeleteAll && remainingIds.length > 0) {
        const keepId = remainingIds[0];
        toDelete = orphanVariants.filter((id) => id !== keepId);
      }

      if (toDelete.length) {
        await supabase
          .from("variant_option_values")
          .delete()
          .in("variant_id", toDelete);
        await supabase
          .from("variant_inventory_transactions")
          .delete()
          .in("variant_id", toDelete);
        await supabase
          .from("variant_inventory")
          .delete()
          .in("variant_id", toDelete);
        await supabase
          .from("variant_prices")
          .delete()
          .in("variant_id", toDelete);
        await supabase.from("product_variants").delete().in("id", toDelete);
      }
    }

    // تنظيف القيم اليتيمة (غير موجودة في المطلوب الآن)
    const { data: allProdValues } = await supabase
      .from("product_option_values")
      .select("id, option_id")
      .in("option_id", Array.from(optionIdMap.values() || []));
    const allValIds = (allProdValues ?? []).map((v) => v.id);
    const desiredValueIdsArr = Array.from(desiredValueIds);
    const orphanValueIds = allValIds.filter(
      (id) => !desiredValueIdsArr.includes(id)
    );
    if (orphanValueIds.length) {
      await supabase
        .from("variant_option_values")
        .delete()
        .in("option_value_id", orphanValueIds);
      await supabase
        .from("product_option_values")
        .delete()
        .in("id", orphanValueIds);
    }

    // حذف خيارات أصبحت بلا قيم
    const { data: checkOpts } = await supabase
      .from("product_option_values")
      .select("option_id");
    const stillHaving = new Set((checkOpts ?? []).map((r) => r.option_id));
    const orphanOptions = Array.from(optionIdMap.values()).filter(
      (oid) => !stillHaving.has(oid)
    );
    if (orphanOptions.length) {
      await supabase.from("product_options").delete().in("id", orphanOptions);
    }

    const enabled =
      (optionsEnabled ?? (usableGroups.length > 0 && variants.length > 0)) ===
      true;

    return ok({
      ok: true,
      optionsEnabled: enabled,
      message:
        "Saved (hard delete for removed groups, safe links, optional prices).",
    });
  } catch (e: any) {
    return fail("PATCH failed", e?.message || e, 500);
  }
}

export const PUT = PATCH;
export const POST = PATCH;
