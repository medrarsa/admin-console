// src/app/api/admin/products/[id]/options/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// ملاحظة: لا نغيّر ملفك الأساس. نستخدم الدالة الإدارية فقط هنا.
import {
  createServerSupabase as createSessionServerClient, // للقراءة (RLS)
  createServiceRoleSupabase, // للكتابة (تجاوز RLS)
} from "@/lib/supabase/server";

/* =========================
   Schemas (بنية المودال)
   ========================= */
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
  sku: z.string().optional().nullable(), // اختياري
  qty: z.number().int().min(0).default(0),
});

const PatchBody = z.object({
  optionsEnabled: z.boolean().optional(),
  groups: z.array(GroupSchema),
  variants: z.array(VariantSchema),
  branchId: z.string().uuid().optional(),
});

/* =========================
   Helpers
   ========================= */
function ok(body: any, status = 200) {
  return NextResponse.json({ status, success: true, ...body }, { status });
}
function fail(message: string, detail?: any, status = 500) {
  return NextResponse.json({ status, success: false, message, detail }, { status });
}
function displayTypeOf(t: "text" | "color" | "image") {
  return t;
}
async function getOrFirstBranchId(supabase: SupabaseClient, preferred?: string | null) {
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

/* =========================
   GET: قراءة الخيارات (جلسة عادية RLS)
   ========================= */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: productId } = await ctx.params;
  if (!productId) return fail("Missing product id", null, 400);

  const supabase = await createSessionServerClient();

  const { data: options, error: optErr } = await supabase
    .from("product_options")
    .select(
      "id, name, display_type, type, sort_order, visibility, associated_with_order_time, not_same_day_order, description"
    )
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  if (optErr) return fail("options.load", optErr.message);

  const optionIds = (options ?? []).map((o) => o.id);
  let valuesByOption = new Map<string, any[]>();
  if (optionIds.length) {
    const { data: vals, error: valErr } = await supabase
      .from("product_option_values")
      .select("id, option_id, name, display_value, image_url, extra_price, extra_price_currency, sort_order")
      .in("option_id", optionIds)
      .order("sort_order", { ascending: true });

    if (valErr) return fail("option_values.load", valErr.message);

    valuesByOption = optionIds.reduce((m, oid) => {
      m.set(
        oid,
        (vals ?? [])
          .filter((v) => v.option_id === oid)
          .map((v) => ({
            id: v.id,
            name: v.name,
            price: { amount: v.extra_price ?? 0, currency: v.extra_price_currency ?? "SAR" },
            display_value: v.display_value ?? "",
            option_id: v.option_id,
            image_url: v.image_url ?? null,
            hashed_display_value: "",
          }))
      );
      return m;
    }, new Map<string, any[]>());
  }

  const data = (options ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    description: o.description ?? null,
    type: o.type,
    required: false,
    associated_with_order_time: o.associated_with_order_time ? 1 : 0,
    sort: o.sort_order ?? 0,
    display_type: o.display_type as "text" | "image" | "color",
    visibility: o.visibility ?? "always",
    values: valuesByOption.get(o.id) ?? [],
    skus: [],
  }));

  return ok({ data });
}

/* =========================
   PATCH: حفظ (يتجاوز RLS) — خيارات اختيارية + SKU تلقائي
   ========================= */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: productId } = await ctx.params;
  if (!productId) return fail("Missing product id", null, 400);

  const json = await req.json();
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return fail("Invalid payload", parsed.error.flatten(), 400);

  const { optionsEnabled, groups, variants, branchId: preferredBranch } = parsed.data;

  // ⚠️ كتابة بصلاحية الخدمة — هذا المسار إداري فقط
  const supabase = createServiceRoleSupabase();

  try {
    const branchId = await getOrFirstBranchId(supabase, preferredBranch ?? null);

    // الخيارات اختيارية: لا ننشئ أي خيارات/قيم إذا ما فيه usableGroups
    const usableGroups =
      optionsEnabled && groups?.length ? groups.filter((g) => g.values && g.values.length > 0) : [];

    const optionIdMap = new Map<string, string>();
    const valueIdMap = new Map<string, string>();

    // 1) upsert product_options + product_option_values (فقط عند وجود usableGroups)
    if (usableGroups.length) {
      const { data: existingOptions } = await supabase
        .from("product_options")
        .select("id")
        .eq("product_id", productId);

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
            })
            .select("id")
            .single();
          if (error) throw new Error(`options.insert: ${error.message}`);
          dbId = data!.id;
        } else {
          const { error } = await supabase
            .from("product_options")
            .update({ name: g.name, display_type: displayTypeOf(g.type), sort_order: idx })
            .eq("id", dbId);
          if (error) throw new Error(`options.update: ${error.message}`);
        }
        optionIdMap.set(g.id, dbId!);
      }

      const { data: exVals } = await supabase.from("product_option_values").select("id, option_id");
      for (const g of usableGroups) {
        const dbOptionId = optionIdMap.get(g.id)!;
        for (let vidx = 0; vidx < g.values.length; vidx++) {
          const v = g.values[vidx];
          let dbValId = exVals?.find((ev) => ev.id === v.id && ev.option_id === dbOptionId)?.id;

          const display_value =
            g.type === "color" ? v.colorHex ?? null : g.type === "image" ? v.imageUrl ?? null : null;

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
    }

    // 2) variants + links + inventory
    const { data: existingVariants } = await supabase
      .from("product_variants")
      .select("id")
      .eq("product_id", productId);

    async function resetVariantLinks(variantId: string) {
      const { error } = await supabase.from("variant_option_values").delete().eq("variant_id", variantId);
      if (error) throw new Error(`links.reset: ${error.message}`);
    }
    async function upsertInventory(variantId: string, qty: number) {
      const { data: inv, error } = await supabase
        .from("variant_inventory")
        .select("id, qty_on_hand")
        .eq("variant_id", variantId)
        .eq("branch_id", branchId)
        .maybeSingle();
      if (error) throw new Error(`inventory.load: ${error.message}`);

      if (!inv) {
        const { error: ins } = await supabase
          .from("variant_inventory")
          .insert({ variant_id: variantId, branch_id: branchId, qty_on_hand: qty ?? 0, qty_reserved: 0 });
        if (ins) throw new Error(`inventory.insert: ${ins.message}`);
      } else {
        const { error: upd } = await supabase
          .from("variant_inventory")
          .update({ qty_on_hand: qty ?? 0 })
          .eq("id", inv.id);
        if (upd) throw new Error(`inventory.update: ${upd.message}`);
      }
    }

    // SKU تلقائي عند الفراغ
    const normalizedVariants = variants.map((v, i) => ({
      ...v,
      sku: v.sku && v.sku.trim().length >= 3 ? v.sku.trim() : autoSku(productId, i),
    }));

    for (const v of normalizedVariants) {
      let dbVarId = existingVariants?.find((ev) => ev.id === v.id)?.id;

      if (!dbVarId) {
        const { data, error } = await supabase
          .from("product_variants")
          .insert({ id: v.id, product_id: productId, sku: v.sku!, status: "active" })
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

      // اربط القيم فقط إذا كان عندنا usableGroups
      await resetVariantLinks(dbVarId!);
      if (usableGroups.length) {
        for (const uiValId of v.optionValueIds) {
          const actualValId = valueIdMap.get(uiValId);
          if (!actualValId) continue; // نتخطى القيم غير المطابقة بدل فشل كامل
          const { error: linkErr } = await supabase
            .from("variant_option_values")
            .insert({ variant_id: dbVarId!, option_value_id: actualValId });
          if (linkErr) throw new Error(`links.insert: ${linkErr.message}`);
        }
      }

      await upsertInventory(dbVarId!, v.qty ?? 0);
    }

    const enabled =
      (optionsEnabled ?? (usableGroups.length > 0 && normalizedVariants.length > 0)) === true;

    return ok({ ok: true, optionsEnabled: enabled, message: "Options & variants saved." });
  } catch (e: any) {
    return fail("PATCH failed", e?.message || e, 500);
  }
}

// مافيه POST منفصل الآن — PATCH يكفي
export const PUT = PATCH;
export const POST = PATCH;
