// src/app/api/admin/products/[id]/options/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";

/* =========================
   Schemas
   ========================= */
const SallaValueInput = z.object({
  name: z.string().min(1),
  price: z.number().optional().default(0),
  display_value: z.string().optional().default(""),
  image_url: z.string().url().optional(),
});

const SallaOptionInput = z.object({
  name: z.string().min(1),
  type: z.enum([
    "radio","textarea","number","checkbox","image","date","time","datetime","map","file","color_picker","splitter",
  ]),
  display_type: z.enum(["text","image","color"]).optional().default("text"),
  visibility: z.enum(["always","on_condition"]).optional().default("always"),
  visibility_condition_type: z.enum(["=","!=",">","<"]).optional(),
  visibility_condition_option: z.string().optional(),
  visibility_condition_value: z.string().optional(),
  sort: z.number().int().optional().default(0),
  advance: z.boolean().optional().default(true),
  associated_with_order_time: z.boolean().optional().default(false),
  not_same_day_order: z.boolean().optional().default(false),
  values: z.array(SallaValueInput).optional().default([]),
});

const ModalValue = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  colorHex: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

const ModalGroup = z.object({
  id: z.string().min(1),
  type: z.enum(["text","color","image"]),
  name: z.string().min(1),
  values: z.array(ModalValue),
});

const ModalVariant = z.object({
  id: z.string().min(1),
  optionValueIds: z.array(z.string().min(1)).nonempty(),
  sku: z.string().optional().default(""),
  qty: z.number().int().min(0).default(0),
});

const PatchBody = z.object({
  optionsEnabled: z.boolean().optional(),
  groups: z.array(ModalGroup),
  variants: z.array(ModalVariant),
  branchId: z.string().uuid().optional(),
});

/* =========================
   Helpers
   ========================= */
function normalizeDisplayType(t: "text"|"image"|"color"){ return t; }

async function getOrFirstBranchId(
  supabase: SupabaseClient,
  preferred?: string | null
){
  if (preferred) return preferred;
  const { data, error } = await supabase
    .from("branches")
    .select("id")
    .order("created_at",{ ascending: true })
    .limit(1);
  if (error) throw new Error(`branches.select: ${error.message}`);
  if (!data?.length) throw new Error("No branches found");
  return data[0].id as string;
}

function ok(data: any, status = 200){
  return NextResponse.json({ status, success: true, ...data }, { status });
}
function fail(message: string, detail?: any, status = 500){
  return NextResponse.json({ status, success: false, message, detail }, { status });
}

/* small guard to catch and tag step */
async function guard<T>(step: string, fn: () => Promise<T>): Promise<T>{
  try { return await fn(); }
  catch (e: any){ throw new Error(`${step}: ${e?.message || e}`); }
}

/* =========================
   GET: كل خيارات المنتج (قريبة من سلة)
   ========================= */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }){
  const { id: productId } = await ctx.params;
  if (!productId) return fail("Missing product id", null, 400);

  const supabase = await createServerClient();

  const { data: options, error: optErr } = await supabase
    .from("product_options")
    .select("id, name, display_type, type, sort_order, visibility, associated_with_order_time, not_same_day_order, description")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });
  if (optErr) return fail("options.load", optErr.message);

  const optionIds = (options ?? []).map(o => o.id);
  let valuesByOption = new Map<string, any[]>();
  if (optionIds.length){
    const { data: vals, error: valErr } = await supabase
      .from("product_option_values")
      .select("id, option_id, name, display_value, image_url, extra_price, extra_price_currency, sort_order")
      .in("option_id", optionIds)
      .order("sort_order", { ascending: true });
    if (valErr) return fail("option_values.load", valErr.message);

    valuesByOption = optionIds.reduce((m, oid) => {
      m.set(oid, (vals ?? [])
        .filter(v => v.option_id === oid)
        .map(v => ({
          id: v.id,
          name: v.name,
          price: { amount: v.extra_price ?? 0, currency: v.extra_price_currency ?? "SAR" },
          display_value: v.display_value ?? "",
          option_id: v.option_id,
          image_url: v.image_url ?? null,
          hashed_display_value: "",
        })));
      return m;
    }, new Map<string, any[]>());
  }

  const data = (options ?? []).map(o => ({
    id: o.id,
    name: o.name,
    description: o.description ?? null,
    type: o.type,
    required: false,
    associated_with_order_time: o.associated_with_order_time ? 1 : 0,
    sort: o.sort_order ?? 0,
    display_type: o.display_type as "text"|"image"|"color",
    visibility: o.visibility ?? "always",
    values: valuesByOption.get(o.id) ?? [],
    skus: [],
  }));

  return ok({ data });
}

/* =========================
   POST (سلة): إنشاء خيار + قيم
   ========================= */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }){
  const { id: productId } = await ctx.params;
  if (!productId) return fail("Missing product id", null, 400);

  const json = await req.json();
  const parsed = SallaOptionInput.safeParse(json);
  if (!parsed.success) return fail("Invalid payload", parsed.error.flatten(), 400);
  const payload = parsed.data;

  const supabase = await createServerClient();

  if (payload.visibility === "on_condition"){
    if (!payload.visibility_condition_type || !payload.visibility_condition_option || !payload.visibility_condition_value){
      return fail("visibility_condition_* required when visibility=on_condition", null, 400);
    }
  }

  const dbType = payload.type === "checkbox" ? "checkbox" : "radio";

  const opt = await guard("options.insert", async () => {
    const { data, error } = await supabase
      .from("product_options")
      .insert({
        product_id: productId,
        name: payload.name,
        type: dbType,
        display_type: normalizeDisplayType(payload.display_type),
        sort_order: payload.sort ?? 0,
        visibility: payload.visibility,
        visibility_condition_type: payload.visibility_condition_type ?? null,
        visibility_condition_option: payload.visibility_condition_option ?? null,
        visibility_condition_value: payload.visibility_condition_value ?? null,
        associated_with_order_time: payload.associated_with_order_time ?? false,
        not_same_day_order: payload.not_same_day_order ?? false,
        required: false,
      })
      .select("id, name, type, display_type, sort_order, visibility, associated_with_order_time, not_same_day_order")
      .single();
    if (error) throw error;
    return data!;
  });

  let valuesOut: any[] = [];
  if (payload.values?.length){
    const rows = payload.values.map((v, idx) => ({
      option_id: opt.id,
      name: v.name,
      display_value: v.display_value || null,
      image_url: v.image_url || null,
      extra_price: v.price ?? 0,
      extra_price_currency: "SAR",
      sort_order: idx,
      is_default: false,
    }));
    valuesOut = await guard("option_values.insert", async () => {
      const { data, error } = await supabase
        .from("product_option_values")
        .insert(rows)
        .select("id, name, display_value, image_url, extra_price, extra_price_currency, option_id, sort_order");
      if (error) throw error;
      return (data ?? []).map((iv) => ({
        id: iv.id,
        name: iv.name,
        price: { amount: iv.extra_price ?? 0, currency: iv.extra_price_currency ?? "SAR" },
        display_value: iv.display_value ?? "",
        option_id: iv.option_id,
        image_url: iv.image_url ?? null,
        hashed_display_value: "",
      }));
    });
  }

  return ok({
    data: {
      id: opt.id,
      name: opt.name,
      description: null,
      type: payload.type,
      required: false,
      associated_with_order_time: opt.associated_with_order_time ? 1 : 0,
      sort: opt.sort_order ?? 0,
      display_type: opt.display_type,
      visibility: opt.visibility,
      values: valuesOut,
      skus: [],
    }
  });
}

/* =========================
   PATCH (المودال): variants + links + inventory
   ========================= */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }){
  const { id: productId } = await ctx.params;
  if (!productId) return fail("Missing product id", null, 400);

  const json = await req.json();
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return fail("Invalid payload", parsed.error.flatten(), 400);
  const { optionsEnabled, groups, variants, branchId: preferredBranch } = parsed.data;

  const supabase = await createServerClient();

  try {
    const branchId = await guard("branches.resolve", () => getOrFirstBranchId(supabase, preferredBranch ?? null));

    // 1) upsert product_options (by id)
    const { data: existingOptions, error: exOptErr } = await supabase
      .from("product_options")
      .select("id, name, display_type, sort_order")
      .eq("product_id", productId);
    if (exOptErr) throw new Error(`options.load: ${exOptErr.message}`);

    const optionIdMap = new Map<string,string>();
    for (let idx = 0; idx < groups.length; idx++){
      const g = groups[idx];
      const display_type = g.type;
      let dbId = existingOptions?.find(o => o.id === g.id)?.id;

      if (!dbId){
        const { data, error } = await supabase
          .from("product_options")
          .insert({
            id: g.id,
            product_id: productId,
            name: g.name,
            display_type,
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
          .update({ name: g.name, display_type, sort_order: idx })
          .eq("id", dbId);
        if (error) throw new Error(`options.update: ${error.message}`);
      }
      optionIdMap.set(g.id, dbId!);
    }

    // 2) upsert product_option_values
    const { data: exVals, error: exValsErr } = await supabase
      .from("product_option_values")
      .select("id, option_id");
    if (exValsErr) throw new Error(`option_values.load: ${exValsErr.message}`);

    const valueIdMap = new Map<string,string>();
    for (const g of groups){
      const dbOptionId = optionIdMap.get(g.id)!;
      for (let vidx = 0; vidx < g.values.length; vidx++){
        const v = g.values[vidx];
        let dbValId = exVals?.find(ev => ev.id === v.id && ev.option_id === dbOptionId)?.id;
        const display_value = g.type === "color" ? (v.colorHex ?? null) :
                              g.type === "image" ? (v.imageUrl ?? null) : null;

        if (!dbValId){
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

    // 3) upsert variants + links + inventory
    const { data: existingVariants, error: exVarErr } = await supabase
      .from("product_variants")
      .select("id")
      .eq("product_id", productId);
    if (exVarErr) throw new Error(`variants.load: ${exVarErr.message}`);

    async function resetVariantLinks(variantId: string){
      const { error } = await supabase.from("variant_option_values").delete().eq("variant_id", variantId);
      if (error) throw new Error(`links.reset: ${error.message}`);
    }
    async function upsertInventory(variantId: string, qty: number){
      const { data: inv, error: invErr } = await supabase
        .from("variant_inventory")
        .select("id, qty_on_hand")
        .eq("variant_id", variantId)
        .eq("branch_id", branchId)
        .maybeSingle();
      if (invErr) throw new Error(`inventory.load: ${invErr.message}`);

      if (!inv){
        const { error: insErr } = await supabase
          .from("variant_inventory")
          .insert({ variant_id: variantId, branch_id: branchId, qty_on_hand: qty ?? 0, qty_reserved: 0 });
        if (insErr) throw new Error(`inventory.insert: ${insErr.message}`);
      } else {
        const { error: updErr } = await supabase
          .from("variant_inventory")
          .update({ qty_on_hand: qty ?? 0 })
          .eq("id", inv.id);
        if (updErr) throw new Error(`inventory.update: ${updErr.message}`);
      }
    }

    for (const v of variants){
      if (!v.sku || v.sku.trim().length < 3) throw new Error("sku invalid (<3 chars)");
      let dbVarId = existingVariants?.find(ev => ev.id === v.id)?.id;

      if (!dbVarId){
        const { data, error } = await supabase
          .from("product_variants")
          .insert({ id: v.id, product_id: productId, sku: v.sku.trim(), status: "active" })
          .select("id")
          .single();
        if (error) throw new Error(`variants.insert: ${error.message}`);
        dbVarId = data!.id;
      } else {
        const { error } = await supabase
          .from("product_variants")
          .update({ sku: v.sku.trim() })
          .eq("id", dbVarId);
        if (error) throw new Error(`variants.update: ${error.message}`);
      }

      await resetVariantLinks(dbVarId!);

      for (const uiValId of v.optionValueIds){
        const actualValId = valueIdMap.get(uiValId);
        if (!actualValId) throw new Error(`links.map: option value not found (${uiValId})`);
        const { error: linkErr } = await supabase
          .from("variant_option_values")
          .insert({ variant_id: dbVarId!, option_value_id: actualValId });
        if (linkErr) throw new Error(`links.insert: ${linkErr.message}`);
      }

      await upsertInventory(dbVarId!, v.qty ?? 0);
    }

    const enabled =
      (optionsEnabled ??
        (groups.length > 0 &&
          groups.some((g) => g.values.length > 0) &&
          variants.length > 0)) === true;

    return ok({ ok: true, optionsEnabled: enabled, message: "Options, variants & inventory saved." });
  } catch (e: any){
    // يرجع step داخل الرسالة، سهل التشخيص
    return fail("PATCH failed", e?.message || e, 500);
  }
}

export const PUT = PATCH; // لو احتجت
