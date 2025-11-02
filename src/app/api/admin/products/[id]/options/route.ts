// src/app/api/admin/products/[id]/options/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";

// ===== Schemas (مطابقة لبُنية المودال) =====
const ValueSchema = z.object({
  id: z.string().min(1),                 // UUID من الواجهة
  label: z.string().min(1),              // يُخزن في product_option_values.name
  colorHex: z.string().optional(),       // لو type=color => يُخزن في display_value
  imageUrl: z.string().url().optional(), // لو type=image => يُخزن في display_value
});

const GroupSchema = z.object({
  id: z.string().min(1),                 // UUID من الواجهة (نربطه بجدول product_options)
  type: z.enum(["text", "color", "image"]),
  name: z.string().min(1),
  values: z.array(ValueSchema),
});

const VariantSchema = z.object({
  id: z.string().min(1),                // UUID من الواجهة (نربطه بجدول product_variants)
  optionValueIds: z.array(z.string().min(1)).nonempty(), // يطابق ترتيب المجموعات القابلة للاستخدام
  sku: z.string().optional().default(""),
  qty: z.number().int().min(0).default(0),
});

const SaveSchema = z.object({
  optionsEnabled: z.boolean().optional(), // سنستنتجه إن لم يوجد
  groups: z.array(GroupSchema),
  variants: z.array(VariantSchema),
  branchId: z.string().uuid().optional(), // فرع للمخزون (اختياري)
});

// ===== Helpers =====
function displayTypeOf(groupType: "text" | "color" | "image") {
  // جدول product_options.display_type يقبل: 'text' | 'image' | 'color'
  return groupType;
}

function valueDisplayOf(
  groupType: "text" | "color" | "image",
  val: z.infer<typeof ValueSchema>
) {
  if (groupType === "color") return val.colorHex ?? null;
  if (groupType === "image") return val.imageUrl ?? null;
  return null; // text
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
  if (!data || !data.length)
    throw new Error(
      "No branches found. Please create a default branch or pass branchId."
    );
  return data[0].id as string;
}

// يبني label للمتحول (للاستهلاك في GET فقط — للعرض)
function buildVariantLabel(
  orderGroups: Array<{ name: string; values: Array<{ id: string; label: string }> }>,
  ids: string[]
) {
  const parts: string[] = [];
  ids.forEach((valId, idx) => {
    const g = orderGroups[idx];
    if (!g) return;
    const v = g.values.find((x) => x.id === valId);
    if (!v) return;
    parts.push(`${g.name || "خيار"}: ${v.label}`);
  });
  return parts.join(" — ");
}

// ====== GET ======
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const productId = params.id;
  if (!productId)
    return NextResponse.json({ error: "Missing product id" }, { status: 400 });

  const supabase = await createServerClient();

  // 1) تحميل مجموعات الخيارات
  const { data: optGroups, error: gErr } = await supabase
    .from("product_options")
    .select("id, name, display_type, type, sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });

  // 2) تحميل القيم لكل مجموعة
  const groupIds = (optGroups ?? []).map((g) => g.id);
  let valuesByGroup = new Map<string, any[]>();
  if (groupIds.length) {
    const { data: vals, error: vErr } = await supabase
      .from("product_option_values")
      .select("id, option_id, name, display_value, sort_order, is_default, extra_price")
      .in("option_id", groupIds)
      .order("sort_order", { ascending: true });

    if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });

    valuesByGroup = groupIds.reduce((m, gid) => {
      const g = optGroups?.find((gg) => gg.id === gid);
      m.set(
        gid,
        (vals ?? [])
          .filter((v) => v.option_id === gid)
          .map((v) => ({
            id: v.id,
            label: v.name,
            colorHex: g?.display_type === "color" ? v.display_value : undefined,
            imageUrl: g?.display_type === "image" ? v.display_value : undefined,
          }))
      );
      return m;
    }, new Map<string, any[]>());
  }

  // 3) تحميل المتغيرات + ربط القيم
  const { data: vars, error: varErr } = await supabase
    .from("product_variants")
    .select("id, sku, status, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: true });

  if (varErr) return NextResponse.json({ error: varErr.message }, { status: 500 });

  const variantIds = (vars ?? []).map((v) => v.id);
  let byVariantVals = new Map<string, string[]>();
  if (variantIds.length) {
    const { data: links, error: lErr } = await supabase
      .from("variant_option_values")
      .select("variant_id, option_value_id")
      .in("variant_id", variantIds);

    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

    links?.forEach((l) => {
      const arr = byVariantVals.get(l.variant_id) ?? [];
      arr.push(l.option_value_id);
      byVariantVals.set(l.variant_id, arr);
    });
  }

  // 4) قراءة كميات المخزون (مجمّعة لكل variant)
  let qtyByVariant = new Map<string, number>();
  if (variantIds.length) {
    const { data: inv, error: iErr } = await supabase
      .from("variant_inventory")
      .select("variant_id, qty_on_hand");
    if (!iErr && inv) {
      inv.forEach((r) => {
        const prev = qtyByVariant.get(r.variant_id) ?? 0;
        qtyByVariant.set(r.variant_id, prev + (r.qty_on_hand ?? 0));
      });
    }
  }

  // 5) ترجمة النتائج إلى تنسيق المودال
  const groups = (optGroups ?? []).map((g) => ({
    id: g.id,
    type: (g.display_type as "text" | "color" | "image") ?? "text",
    name: g.name,
    values: valuesByGroup.get(g.id) ?? [],
  }));

  // نبني بيانات للـ label بحسب الترتيب
  const groupsForLabel = groups.map((g) => ({
    name: g.name,
    values: g.values.map((v) => ({ id: v.id, label: v.label })),
  }));

  const variants = (vars ?? []).map((v) => {
    const valueIds = byVariantVals.get(v.id) ?? [];
    const label = buildVariantLabel(groupsForLabel, valueIds);
    return {
      id: v.id,
      optionValueIds: valueIds,
      sku: v.sku ?? "",
      qty: qtyByVariant.get(v.id) ?? 0,
      label,
    };
  });

  const enabled =
    groups.length > 0 &&
    groups.some((g) => g.values.length > 0) &&
    variants.length > 0;

  return NextResponse.json({
    optionsEnabled: enabled,
    groups,
    variants,
  });
}

// ====== POST (Save) ======
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const productId = params.id;
  if (!productId)
    return NextResponse.json({ error: "Missing product id" }, { status: 400 });

  const json = await req.json();
  const parsed = SaveSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { optionsEnabled, groups, variants, branchId: preferredBranch } =
    parsed.data;

  const supabase = await createServerClient();

  // سنستعمل فرع واحد للمخزون الآن
  const branchId = await getOrFirstBranchId(supabase, preferredBranch ?? null);

  // === 1) Upsert product_options
  // خارطة: id الواجهة (UUID) -> id الفعلي في DB
  const optionIdMap = new Map<string, string>();

  // قراءة الموجود الحالي
  const { data: existingOptions, error: eoErr } = await supabase
    .from("product_options")
    .select("id, name, display_type, sort_order")
    .eq("product_id", productId);
  if (eoErr) return NextResponse.json({ error: eoErr.message }, { status: 500 });

  for (let idx = 0; idx < groups.length; idx++) {
    const g = groups[idx];
    const display_type = displayTypeOf(g.type);

    let dbId = existingOptions?.find((o) => o.id === g.id)?.id;

    if (!dbId) {
      // إنشاء
      const { data: ins, error: insErr } = await supabase
        .from("product_options")
        .insert({
          id: g.id, // نستخدم نفس id القادم من الواجهة لتسهيل الربط
          product_id: productId,
          name: g.name,
          display_type,
          type: "radio", // في هذه المرحلة
          sort_order: idx,
        })
        .select("id")
        .single();
      if (insErr)
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      dbId = ins.id;
    } else {
      // تحديث
      const { error: updErr } = await supabase
        .from("product_options")
        .update({
          name: g.name,
          display_type,
          type: "radio",
          sort_order: idx,
        })
        .eq("id", dbId);
      if (updErr)
        return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
    optionIdMap.set(g.id, dbId);
  }

  // === 2) Upsert product_option_values
  // خارطة: valueId واجهة -> valueId فعلي DB
  const valueIdMap = new Map<string, string>();

  // نقرأ الموجود
  const optionDbIds = Array.from(optionIdMap.values());
  let existingValues: Array<any> = [];
  if (optionDbIds.length) {
    const { data: exVals, error: exValsErr } = await supabase
      .from("product_option_values")
      .select("id, option_id, name, display_value, sort_order");
    if (exValsErr)
      return NextResponse.json({ error: exValsErr.message }, { status: 500 });
    existingValues = exVals ?? [];
  }

  for (const g of groups) {
    const dbOptionId = optionIdMap.get(g.id)!;
    for (let vidx = 0; vidx < g.values.length; vidx++) {
      const v = g.values[vidx];
      const display_value = valueDisplayOf(g.type, v);

      let dbValId = existingValues.find(
        (ev) => ev.id === v.id && ev.option_id === dbOptionId
      )?.id;

      if (!dbValId) {
        // إنشاء
        const { data: insV, error: insVErr } = await supabase
          .from("product_option_values")
          .insert({
            id: v.id, // نستخدم نفس id القادم من الواجهة
            option_id: dbOptionId,
            name: v.label,
            display_value,
            sort_order: vidx,
            is_default: false,
            extra_price: 0,
          })
          .select("id")
          .single();
        if (insVErr)
          return NextResponse.json({ error: insVErr.message }, { status: 500 });
        dbValId = insV.id;
      } else {
        // تحديث
        const { error: updVErr } = await supabase
          .from("product_option_values")
          .update({
            name: v.label,
            display_value,
            sort_order: vidx,
          })
          .eq("id", dbValId);
        if (updVErr)
          return NextResponse.json({ error: updVErr.message }, { status: 500 });
      }
      valueIdMap.set(v.id, dbValId);
    }
  }

  // === 3) Upsert product_variants + variant_option_values + inventory
  const { data: existingVariants, error: evErr } = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", productId);
  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });

  async function resetVariantLinks(variantId: string) {
    const { error } = await supabase
      .from("variant_option_values")
      .delete()
      .eq("variant_id", variantId);
    if (error) throw error;
  }

  async function upsertInventory(variantId: string, qty: number) {
    const { data: inv, error: invErr } = await supabase
      .from("variant_inventory")
      .select("id, qty_on_hand")
      .eq("variant_id", variantId)
      .eq("branch_id", branchId)
      .maybeSingle();
    if (invErr) throw invErr;

    if (!inv) {
      const { error: insInvErr } = await supabase.from("variant_inventory").insert({
        variant_id: variantId,
        branch_id: branchId,
        qty_on_hand: qty ?? 0,
        qty_reserved: 0,
      });
      if (insInvErr) throw insInvErr;
    } else {
      const { error: updInvErr } = await supabase
        .from("variant_inventory")
        .update({ qty_on_hand: qty ?? 0 })
        .eq("id", inv.id);
      if (updInvErr) throw updInvErr;
    }
  }

  for (const v of variants) {
    // upsert variant
    let dbVarId = existingVariants?.find((ev) => ev.id === v.id)?.id;
    if (!dbVarId) {
      const { data: insVar, error: insVarErr } = await supabase
        .from("product_variants")
        .insert({
          id: v.id, // نستخدم نفس id القادم من الواجهة
          product_id: productId,
          sku: v.sku ?? "",
          status: "active",
        })
        .select("id")
        .single();
      if (insVarErr)
        return NextResponse.json({ error: insVarErr.message }, { status: 500 });
      dbVarId = insVar.id;
    } else {
      const { error: updVarErr } = await supabase
        .from("product_variants")
        .update({ sku: v.sku ?? "" })
        .eq("id", dbVarId);
      if (updVarErr)
        return NextResponse.json({ error: updVarErr.message }, { status: 500 });
    }

    // الروابط
    await resetVariantLinks(dbVarId);
    for (const uiValId of v.optionValueIds) {
      const actualValId = valueIdMap.get(uiValId);
      if (!actualValId) {
        return NextResponse.json(
          { error: `Option value not found mapping for ${uiValId}` },
          { status: 400 }
        );
      }
      const { error: linkErr } = await supabase
        .from("variant_option_values")
        .insert({ variant_id: dbVarId, option_value_id: actualValId });
      if (linkErr)
        return NextResponse.json({ error: linkErr.message }, { status: 500 });
    }

    // المخزون
    try {
      await upsertInventory(dbVarId, v.qty ?? 0);
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.message || "Inventory upsert failed" },
        { status: 500 }
      );
    }
  }

  // === 4) optionsEnabled
  const enabled =
    (optionsEnabled ??
      (groups.length > 0 &&
        groups.some((g) => g.values.length > 0) &&
        variants.length > 0)) === true;

  // لو عندك عمود products.options_enabled وفعلت تخزينه، فعّل هذا:
  // const { error: prodUpdErr } = await supabase
  //   .from("products")
  //   .update({ options_enabled: enabled })
  //   .eq("id", productId);
  // if (prodUpdErr)
  //   return NextResponse.json({ error: prodUpdErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    optionsEnabled: enabled,
    message: "Product options & variants saved successfully.",
  });
}

export const PATCH = POST;
