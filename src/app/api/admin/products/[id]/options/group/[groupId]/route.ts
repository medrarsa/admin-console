// src/app/api/admin/products/[id]/options/group/[groupId]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

/* Utils */
const ok = (data: any = {}, status = 200) =>
  NextResponse.json({ success: true, status, ...data }, { status });
const fail = (message: string, status = 400, meta?: any) =>
  NextResponse.json({ success: false, status, message, meta }, { status });

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; groupId: string }> }
) {
  const { id: productId, groupId } = await ctx.params;
  if (!productId || !groupId) return fail("Missing productId/groupId", 400);

  try {
    const db = createServiceRoleSupabase();

    // 0) تأكد أن المجموعة تخص هذا المنتج
    const { data: groupRow, error: gErr } = await db
      .from("product_options")
      .select("id, product_id")
      .eq("id", groupId)
      .eq("product_id", productId)
      .maybeSingle();
    if (gErr)
      return fail(gErr.message, 400, { where: "select/product_options" });
    if (!groupRow?.id)
      return fail("Option group not found for this product", 404);

    // 1) جميع قيم هذه المجموعة
    const { data: vals, error: vErr } = await db
      .from("product_option_values")
      .select("id")
      .eq("option_id", groupId);
    if (vErr)
      return fail(vErr.message, 400, { where: "select/product_option_values" });
    const valueIds = (vals ?? []).map((r) => r.id);

    // 2) كل متغيرات هذا المنتج (أقدم واحد = main)
    const { data: allVariants, error: varErr } = await db
      .from("product_variants")
      .select("id, created_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: true });
    if (varErr)
      return fail(varErr.message, 400, { where: "select/product_variants" });
    const variantIdsAll = (allVariants ?? []).map((r) => r.id);

    // 3) احذف روابط القيم لهذه المجموعة، ثم القيم نفسها
    if (valueIds.length) {
      const { error: delLinksByValue } = await db
        .from("variant_option_values")
        .delete()
        .in("option_value_id", valueIds);
      if (delLinksByValue)
        return fail(delLinksByValue.message, 400, {
          where: "delete/variant_option_values/byValueIds",
        });

      const { error: delValues } = await db
        .from("product_option_values")
        .delete()
        .in("id", valueIds);
      if (delValues)
        return fail(delValues.message, 400, {
          where: "delete/product_option_values",
        });
    }

    // 4) حدّد المتغيرات التي أصبحت بلا أي روابط قيم (أيتام) بعد النزع
    let orphanVariantIds: string[] = [];
    if (variantIdsAll.length) {
      const { data: stillLinked, error: linkErr } = await db
        .from("variant_option_values")
        .select("variant_id")
        .in("variant_id", variantIdsAll);
      if (linkErr)
        return fail(linkErr.message, 400, {
          where: "select/variant_option_values",
        });

      const linkedSet = new Set((stillLinked ?? []).map((r) => r.variant_id));
      orphanVariantIds = variantIdsAll.filter((id) => !linkedSet.has(id));

      if (orphanVariantIds.length) {
        // ⚠️ لو كان الحذف سيشمل كل المتغيرات، أبقِ الأقدم (main)
        const willDeleteAll = orphanVariantIds.length === variantIdsAll.length;
        let toDelete = orphanVariantIds;

        if (willDeleteAll && variantIdsAll.length > 0) {
          const keepId = variantIdsAll[0]; // الأقدم = main
          toDelete = orphanVariantIds.filter((id) => id !== keepId);
        }

        if (toDelete.length) {
          // حذف الحركات والمخزون والأسعار والروابط والمتغيرات
          const { error: delInvTx } = await db
            .from("variant_inventory_transactions")
            .delete()
            .in("variant_id", toDelete);
          if (delInvTx)
            return fail(delInvTx.message, 400, {
              where: "delete/variant_inventory_transactions",
            });

          const { error: delInv } = await db
            .from("variant_inventory")
            .delete()
            .in("variant_id", toDelete);
          if (delInv)
            return fail(delInv.message, 400, {
              where: "delete/variant_inventory",
            });

          const { error: delPrices } = await db
            .from("variant_prices")
            .delete()
            .in("variant_id", toDelete);
          if (delPrices)
            return fail(delPrices.message, 400, {
              where: "delete/variant_prices",
            });

          const { error: delLinksOrphans } = await db
            .from("variant_option_values")
            .delete()
            .in("variant_id", toDelete);
          if (delLinksOrphans)
            return fail(delLinksOrphans.message, 400, {
              where: "delete/variant_option_values/byVariantIds",
            });

          const { error: delVariants } = await db
            .from("product_variants")
            .delete()
            .in("id", toDelete);
          if (delVariants)
            return fail(delVariants.message, 400, {
              where: "delete/product_variants",
            });
        }
      }
    }

    // 5) احذف المجموعة نفسها (مقيّدة بالمنتج)
    const { error: delGroup } = await db
      .from("product_options")
      .delete()
      .eq("id", groupId)
      .eq("product_id", productId);
    if (delGroup)
      return fail(delGroup.message, 400, { where: "delete/product_options" });

    return ok({
      message:
        "Option group deleted permanently. Orphan variants cleaned (preserving main if needed).",
      removed_variant_ids: orphanVariantIds,
      removed_value_ids: valueIds,
    });
  } catch (e: any) {
    return fail(e?.message || "DELETE failed", 500);
  }
}
