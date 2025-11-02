// src/app/api/admin/products/[id]/options/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";

/* =========================
   Zod Schemas
   ========================= */

// سلة: إنشاء خيار + قيم
const SallaValueInput = z.object({
  name: z.string().min(1),
  price: z.number().optional().default(0),       // extra_price لكل قيمة
  display_value: z.string().optional().default(""), // لو color: "#000000" — لو text: ممكن فاضي — لو image: id/نص
  image_url: z.string().url().optional(),        // بديل عملي خارج سلة
});

const SallaOptionInput = z.object({
  name: z.string().min(1),
  type: z.enum([
    "radio", "textarea", "number", "checkbox", "image",
    "date", "time", "datetime", "map", "file", "color_picker", "splitter",
  ]),
  display_type: z.enum(["text", "image", "color"]).optional().default("text"),
  visibility: z.enum(["always", "on_condition"]).optional().default("always"),
  visibility_condition_type: z.enum(["=", "!=", ">", "<"]).optional(),
  visibility_condition_option: z.string().optional(),
  visibility_condition_value: z.string().optional(),
  sort: z.number().int().optional().default(0),
  advance: z.boolean().optional().default(true),
  associated_with_order_time: z.boolean().optional().default(false),
  not_same_day_order: z.boolean().optional().default(false),
  values: z.array(SallaValueInput).optional().default([]),
});

// مودالك الحالي: حفظ المتغيرات + الكميات
const ModalValue = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  colorHex: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

const ModalGroup = z.object({
  id: z.string().min(1),
  type: z.enum(["text", "color", "image"]),
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

function normalizeDisplayType(t: "text" | "image" | "color") {
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
  if (!data?.length) throw new Error("No branches found. Create one or pass branchId.");
  return data[0].id as string;
}

/* =========================
   GET: رجّع كل خيارات المنتج بصيغة قريبة من سلة
   ========================= */

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await ctx.params;
  if (!productId)
    return NextResponse.json({ status: 400, success: false, message: "Missing product id" }, { status: 400 });

  const supabase = await createServerClient();

  // خيارات المنتج
  const { data: options, error: optErr } = await supabase
    .from("product_options")
    .select("id, name, display_type, type, sort_order, visibility, associated_with_order_time, not_same_day_order, description")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  if (optErr) return NextResponse.json({ status: 500, success: false, message: optErr.message }, { status: 500 });

  // قيم كل خيار
  const optionIds = (options ?? []).map(o => o.id);
  let valuesByOption = new Map<string, any[]>();
  if (optionIds.length) {
    const { data: vals, error: valErr } = await supabase
      .from("product_option_values")
      .select("id, option_id, name, display_value, image_url, extra_price, extra_price_currency, sort_order")
      .in("option_id", optionIds)
      .order("sort_order", { ascending: true });
    if (valErr) return NextResponse.json({ status: 500, success: false, message: valErr.message }, { status: 500 });

    valuesByOption = optionIds.reduce((m, oid) => {
      m.set(
        oid,
        (vals ?? [])
          .filter(v => v.option_id === oid)
          .map(v => ({
            id: v.id,
            name: v.name,
            price: { amount: v.extra_price ?? 0, currency: v.extra_price_currency ?? "SAR" },
            display_value: v.display_value ?? "",
            option_id: v.option_id,
            image_url: v.image_url ?? null,
            hashed_display_value: "", // غير مستخدم لدينا حاليًا
          }))
      );
      return m;
    }, new Map<string, any[]>());
  }

  const data = (options ?? []).map(o => ({
    id: o.id,
    name: o.name,
    description: o.description ?? null,
    type: o.type, // نخزّنه كـ radio/checkbox (باقي الأنواع نعكسها في POST)
    required: false,
    associated_with_order_time: o.associated_with_order_time ? 1 : 0,
    sort: o.sort_order ?? 0,
    display_type: o.display_type as "text" | "image" | "color",
    visibility: o.visibility ?? "always",
    values: valuesByOption.get(o.id) ?? [],
    skus: [], // المتغيرات تدار من PATCH/مودالك — نتركها هنا فاضية
  }));

  return NextResponse.json({ status: 200, success: true, data });
}

/* =========================
   POST (سلة): إنشاء خيار + قيم
   ========================= */

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await ctx.params;
  if (!productId)
    return NextResponse.json({ status: 400, success: false, message: "Missing product id" }, { status: 400 });

  const json = await req.json();
  const parsed = SallaOptionInput.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ status: 400, success: false, message: "Invalid payload", errors: parsed.error.flatten() }, { status: 400 });

  const payload = parsed.data;
  const supabase = await createServerClient();

  if (payload.visibility === "on_condition") {
    if (!payload.visibility_condition_type || !payload.visibility_condition_option || !payload.visibility_condition_value) {
      return NextResponse.json({
        status: 400,
        success: false,
        message: "visibility_condition_* required when visibility=on_condition",
      }, { status: 400 });
    }
  }

  // خزن كـ radio/checkbox (لتوافق CHECK). الأنواع الأخرى نعيدها في الرد فقط.
  const dbType = payload.type === "checkbox" ? "checkbox" : "radio";

  // 1) إنشاء الخيار
  const { data: opt, error: optErr } = await supabase
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

  if (optErr) return NextResponse.json({ status: 500, success: false, message: optErr.message }, { status: 500 });

  // 2) إنشاء القيم
  let valuesOut: any[] = [];
  if (payload.values?.length) {
    const rows = payload.values.map((v, idx) => ({
      option_id: opt.id,
      name: v.name,
      display_value: v.display_value || null, // color hex أو نص
      image_url: v.image_url || null,
      extra_price: v.price ?? 0,
      extra_price_currency: "SAR",
      sort_order: idx,
      is_default: false,
    }));
    const { data: vals, error: valErr } = await supabase
      .from("product_option_values")
      .insert(rows)
      .select("id, name, display_value, image_url, extra_price, extra_price_currency, option_id, sort_order");

    if (valErr) return NextResponse.json({ status: 500, success: false, message: valErr.message }, { status: 500 });

    valuesOut = (vals ?? []).map((iv) => ({
      id: iv.id,
      name: iv.name,
      price: { amount: iv.extra_price ?? 0, currency: iv.extra_price_currency ?? "SAR" },
      display_value: iv.display_value ?? "",
      option_id: iv.option_id,
      image_url: iv.image_url ?? null,
      hashed_display_value: "",
    }));
  }

  // 3) الرد
  return NextResponse.json({
    status: 200,
    success: true,
    data: {
      id: opt.id,
      name: opt.name,
      description: null,
      type: payload.type, // نعيد الأصلي الذي أرسلته
      required: false,
      associated_with_order_time: opt.associated_with_order_time ? 1 : 0,
      sort: opt.sort_order ?? 0,
      display_type: opt.display_type,
      visibility: opt.visibility,
      values: valuesOut,
      skus: [],
    },
  });
}

/* =========================
   PATCH (مودال المتغيرات والكميات)
   يكتب: product_variants + variant_option_values + variant_inventory
   ========================= */

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await ctx.params;
  if (!productId)
    return NextResponse.json({ error: "Missing product id" }, { status: 400 });

  const json = await req.json();
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { optionsEnabled, groups, variants, branchId: preferredBranch } = parsed.data;
  const supabase = await createServerClient();
  const branchId = await getOrFirstBranchId(supabase, preferredBranch ?? null);

  // 1) نضمن أن كل مجموعة موجودة (id من الواجهة) — upsert مبسط بالاسم/النوع
  const optionIdMap = new Map<string, string>();
  const { data: existingOptions } = await supabase
    .from("product_options")
    .select("id, name")
    .eq("product_id", productId);

  for (let idx = 0; idx < groups.length; idx++) {
    const g = groups[idx];
    let dbId = existingOptions?.find(o => o.id === g.id)?.id;
    if (!dbId) {
      const { data: ins, error } = await supabase
        .from("product_options")
        .insert({
          id: g.id,
          product_id: productId,
          name: g.name,
          display_type: g.type,
          type: "radio",
          sort_order: idx,
        })
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      dbId = ins.id;
    } else {
      const { error } = await supabase
        .from("product_options")
        .update({ name: g.name, display_type: g.type, sort_order: idx })
        .eq("id", dbId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    optionIdMap.set(g.id, dbId!);
  }

  // 2) upsert لقيم الخيارات
  const valueIdMap = new Map<string, string>();
  const { data: exVals } = await supabase
    .from("product_option_values")
    .select("id, option_id");
  for (const g of groups) {
    const dbOptionId = optionIdMap.get(g.id)!;
    for (let vidx = 0; vidx < g.values.length; vidx++) {
      const v = g.values[vidx];
      let dbValId = exVals?.find(ev => ev.id === v.id && ev.option_id === dbOptionId)?.id;
      const display_value = g.type === "color" ? (v.colorHex ?? null)
                        : g.type === "image" ? (v.imageUrl ?? null)
                        : null;
      if (!dbValId) {
        const { data: insV, error } = await supabase
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
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        dbValId = insV.id;
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
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      valueIdMap.set(v.id, dbValId!);
    }
  }

  // 3) upsert variants + links + inventory
  const { data: existingVariants } = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", productId);

  async function resetVariantLinks(variantId: string) {
    const { error } = await supabase
      .from("variant_option_values")
      .delete()
      .eq("variant_id", variantId);
    if (error) throw error;
  }
  async function upsertInventory(variantId: string, qty: number) {
    const { data: inv, error } = await supabase
      .from("variant_inventory")
      .select("id, qty_on_hand")
      .eq("variant_id", variantId)
      .eq("branch_id", branchId)
      .maybeSingle();
    if (error) throw error;
    if (!inv) {
      const { error: ins } = await supabase
        .from("variant_inventory")
        .insert({ variant_id: variantId, branch_id: branchId, qty_on_hand: qty ?? 0, qty_reserved: 0 });
      if (ins) throw ins;
    } else {
      const { error: upd } = await supabase
        .from("variant_inventory")
        .update({ qty_on_hand: qty ?? 0 })
        .eq("id", inv.id);
      if (upd) throw upd;
    }
  }

  for (const v of variants) {
    let dbVarId = existingVariants?.find(ev => ev.id === v.id)?.id;
    if (!dbVarId) {
      const { data: insVar, error } = await supabase
        .from("product_variants")
        .insert({ id: v.id, product_id: productId, sku: v.sku ?? "", status: "active" })
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      dbVarId = insVar.id;
    } else {
      const { error } = await supabase
        .from("product_variants")
        .update({ sku: v.sku ?? "" })
        .eq("id", dbVarId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await resetVariantLinks(dbVarId!);
    for (const uiValId of v.optionValueIds) {
      const actualValId = valueIdMap.get(uiValId);
      if (!actualValId) {
        return NextResponse.json({ error: `Option value not found mapping for ${uiValId}` }, { status: 400 });
      }
      const { error } = await supabase
        .from("variant_option_values")
        .insert({ variant_id: dbVarId!, option_value_id: actualValId });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      await upsertInventory(dbVarId!, v.qty ?? 0);
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || "Inventory upsert failed" }, { status: 500 });
    }
  }

  const enabled =
    (optionsEnabled ??
      (groups.length > 0 &&
        groups.some((g) => g.values.length > 0) &&
        variants.length > 0)) === true;

  return NextResponse.json({
    ok: true,
    optionsEnabled: enabled,
    message: "Options, variants & inventory saved.",
  });
}
