// src/app/api/admin/products/[id]/options/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

/* ===== Schemas ===== */
const ValueSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  colorHex: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

const GroupSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["text", "color", "image"]),
  name: z.string().min(1),
  values: z.array(ValueSchema),
});

const VariantSchema = z.object({
  id: z.string().min(1),
  optionValueIds: z.array(z.string().min(1)).nonempty(),
  sku: z.string().optional().nullable(),
  qty: z.number().int().min(0).default(0),
  // السعر اختياري: سيمر كحقل إضافي على الكائن ونقرأه بـ (v as any).price
});

const PatchBody = z.object({
  optionsEnabled: z.boolean().optional(),
  groups: z.array(GroupSchema),
  variants: z.array(VariantSchema),
  branchId: z.string().uuid().optional(),
});

/* ===== Helpers ===== */
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
  const q = Math.floor(i / A.length);
  const r = i % A.length;
  return "-" + A[r] + q;
}
function ensureUniqueSku(base: string, taken: Set<string>) {
  let candidate = base,
    i = 0;
  while (taken.has(candidate)) candidate = base + uniqueSuffix(i++);
  taken.add(candidate);
  return candidate;
}

/* =========================
   GET (Service Role)
   ========================= */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await ctx.params;
  if (!productId) return fail("Missing product id", null, 400);

  const supabase = createServiceRoleSupabase();

  // خيارات المنتج
  const { data: optGroups, error: gErr } = await supabase
    .from("product_options")
    .select("id, name, display_type, sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });
  if (gErr) return fail("options.load", gErr.message);

  // قيم الخيارات
  const groupIds = (optGroups ?? []).map((g) => g.id);
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
            id: v.id,
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

  // روابط المتغيرات بالقيم
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

  // الكميات (مجمّعة عبر الفروع)
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

  // آخر سعر لكل متغير (retail) — نستخدم DISTINCT ON
  let priceByVariant = new Map<string, number>();
  if (variantIds.length) {
    const { data: vpErrData, error: vpErr } = await supabase.rpc("exec_sql", {
      // function exec_sql(text) returns setof record — إن لم تكن موجودة تجاهل هذا القسم واستخدم select عادي.
      // إن لم يكن لديك RPC عام، استبدل هذا الاستدعاء بجدولين:
      // 1) fetch all variant_prices for product variants
      // 2) ثم احسب آخر صف لكل variant_id هنا
      sql: `
          SELECT DISTINCT ON (variant_id) variant_id, price
          FROM variant_prices
          WHERE variant_id = ANY (ARRAY[${variantIds
            .map((id) => `'${id}'`)
            .join(",")}])
            AND price_type = 'retail'
          ORDER BY variant_id, created_at DESC
        `,
    } as any); // ملاحظة: إذا لا يوجد RPC exec_sql لديك، تجاهل هذا واستعمل الطريقة البديلة أدناه.
    if (!vpErr && Array.isArray(vpErrData)) {
      for (const row of vpErrData as any[]) {
        priceByVariant.set(row.variant_id, Number(row.price));
      }
    } else {
      // طريقة بديلة بدون RPC: اجلب كل الأسعار ثم اختر أحدث سعر لكل variant_id
      const { data: allPrices } = await supabase
        .from("variant_prices")
        .select("variant_id, price, created_at, price_type")
        .in("variant_id", variantIds)
        .eq("price_type", "retail");
      const latest = new Map<string, { price: number; created_at: string }>();
      for (const p of allPrices ?? []) {
        const prev = latest.get(p.variant_id);
        if (!prev || new Date(p.created_at) > new Date(prev.created_at)) {
          latest.set(p.variant_id, {
            price: Number(p.price),
            created_at: p.created_at,
          });
        }
      }
      for (const [vid, obj] of latest.entries())
        priceByVariant.set(vid, obj.price);
    }
  }

  const groups = (optGroups ?? []).map((g) => ({
    id: g.id,
    type: (g.display_type as "text" | "color" | "image") ?? "text",
    name: g.name,
    values: valuesByGroup.get(g.id) ?? [],
  }));

  const variants = (vars ?? []).map((v) => ({
    id: v.id,
    optionValueIds: byVariantVals.get(v.id) ?? [],
    sku: v.sku ?? "",
    qty: qtyByVariant.get(v.id) ?? 0,
    price: priceByVariant.get(v.id), // ← نُرجع السعر إن وُجد
  }));

  const optionsEnabled =
    groups.length > 0 &&
    groups.some((g) => g.values.length > 0) &&
    variants.length > 0;

  return ok({ success: true, optionsEnabled, groups, variants });
}

/* =========================
   PATCH (Service Role)
   ========================= */
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
  } = parsed.data;

  const supabase = createServiceRoleSupabase();

  try {
    const resolvedBranchId = await getOrFirstBranchId(
      supabase,
      preferredBranch ?? null
    );

    // 1) options + values (UPSERT)
    const usableGroups = groups.filter((g) => g.values.length > 0);
    const { data: existingOptions } = await supabase
      .from("product_options")
      .select("id")
      .eq("product_id", productId);

    const optionIdMap = new Map<string, string>();
    const valueIdMap = new Map<string, string>();

    for (let idx = 0; idx < usableGroups.length; idx++) {
      const g = usableGroups[idx];
      let dbId = existingOptions?.find((o) => o.id === g.id)?.id;
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

    const { data: exVals } = await supabase
      .from("product_option_values")
      .select("id, option_id");

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
      }
    }

    // 2) variants + links + inventory + price
    const { data: existingVariants } = await supabase
      .from("product_variants")
      .select("id, sku")
      .eq("product_id", productId);

    const takenSkus = new Set<string>(
      (existingVariants ?? [])
        .map((v) => (v.sku || "").trim())
        .filter((s) => s.length > 0)
    );

    const normalizedVariants = variants.map((v, i) => {
      const base =
        v.sku && v.sku.trim().length >= 3
          ? v.sku.trim()
          : autoSku(productId, i);
      const finalSku = ensureUniqueSku(base, takenSkus);
      return { ...v, sku: finalSku };
    });

    async function resetVariantLinks(variantId: string) {
      const { error } = await supabase
        .from("variant_option_values")
        .delete()
        .eq("variant_id", variantId);
      if (error) throw new Error(`links.reset: ${error.message}`);
    }

    async function upsertInventory(variantId: string, qty: number) {
      const { data: inv, error } = await supabase
        .from("variant_inventory")
        .select("id, qty_on_hand")
        .eq("variant_id", variantId)
        .eq("branch_id", resolvedBranchId)
        .maybeSingle();
      if (error) throw new Error(`inventory.load: ${error.message}`);

      if (!inv) {
        const { error: ins } = await supabase.from("variant_inventory").insert({
          variant_id: variantId,
          branch_id: resolvedBranchId,
          qty_on_hand: qty ?? 0,
          qty_reserved: 0,
        });
        if (ins) throw new Error(`inventory.insert: ${ins.message}`);
      } else {
        const { error: upd } = await supabase
          .from("variant_inventory")
          .update({ qty_on_hand: qty ?? 0 })
          .eq("id", inv.id);
        if (upd) throw new Error(`inventory.update: ${upd.message}`);
      }
    }

    for (const v of normalizedVariants) {
      let dbVarId = existingVariants?.find((ev) => ev.id === v.id)?.id;

      // INSERT/UPDATE variant
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

      // relinks
      await resetVariantLinks(dbVarId!);
      if (groups.length) {
        for (const uiValId of v.optionValueIds) {
          const actualValId = valueIdMap.get(uiValId);
          if (!actualValId) continue;
          const { error: linkErr } = await supabase
            .from("variant_option_values")
            .insert({
              variant_id: dbVarId!,
              option_value_id: actualValId,
            });
          if (linkErr) throw new Error(`links.insert: ${linkErr.message}`);
        }
      }

      // inventory
      await upsertInventory(dbVarId!, (v as any)?.qty ?? 0);

      // price (اختياري): لو وصل price، نحفظه كأحدث retail
      const maybePrice = (v as any)?.price;
      if (typeof maybePrice === "number" && !Number.isNaN(maybePrice)) {
        // امسح أسعار retail السابقة لهذا المتغير ثم أضف السعر الجديد
        const { error: delOld } = await supabase
          .from("variant_prices")
          .delete()
          .eq("variant_id", dbVarId!)
          .eq("price_type", "retail");
        if (delOld) throw new Error(`variant_prices.delete: ${delOld.message}`);

        const { error: insPrice } = await supabase
          .from("variant_prices")
          .insert({
            variant_id: dbVarId!,
            price: maybePrice,
            currency: "SAR",
            price_type: "retail",
            // starts_at: default now()
          });
        if (insPrice)
          throw new Error(`variant_prices.insert: ${insPrice.message}`);
      }
    }

    const enabled =
      (optionsEnabled ??
        (groups.filter((g) => g.values.length > 0).length > 0 &&
          normalizedVariants.length > 0)) === true;

    return ok({
      ok: true,
      optionsEnabled: enabled,
      message: "Options, variants, inventory & prices saved.",
    });
  } catch (e: any) {
    return fail("PATCH failed", e?.message || e, 500);
  }
}

export const PUT = PATCH;
export const POST = PATCH;
