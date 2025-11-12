// src/app/api/admin/products/[id]/options/value/[valueId]/route.ts
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
  ctx: { params: Promise<{ id: string; valueId: string }> }
) {
  const { id: productId, valueId } = await ctx.params;
  if (!productId || !valueId) return fail("Missing productId/valueId", 400);

  try {
    const db = createServiceRoleSupabase();

    // 0) تأكيد أن قيمة الخيار تخص هذا المنتج
    const { data: valRow, error: vErr } = await db
      .from("product_option_values")
      .select("id, option_id")
      .eq("id", valueId)
      .maybeSingle();
    if (vErr)
      return fail(vErr.message, 400, { where: "select/product_option_values" });
    if (!valRow?.id) return fail("Option value not found", 404);

    const { data: optRow, error: oErr } = await db
      .from("product_options")
      .select("id, product_id")
      .eq("id", valRow.option_id)
      .maybeSingle();
    if (oErr)
      return fail(oErr.message, 400, { where: "select/product_options" });
    if (!optRow?.id) return fail("Option group not found", 404);
    if (optRow.product_id !== productId) {
      return fail("Option value does not belong to this product", 403);
    }

    // 1) كل متغيرات هذا المنتج (مرتب بالأقدم أولاً = main)
    const { data: allVariants, error: varErr } = await db
      .from("product_variants")
      .select("id, created_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: true });
    if (varErr)
      return fail(varErr.message, 400, { where: "select/product_variants" });

    const variantIdsAll = (allVariants ?? []).map((v) => v.id);

    // 2) احذف روابط هذه القيمة من المتغيرات
    const { error: delLinks } = await db
      .from("variant_option_values")
      .delete()
      .eq("option_value_id", valueId);
    if (delLinks)
      return fail(delLinks.message, 400, {
        where: "delete/variant_option_values/byValue",
      });

    // 3) حدد المتغيرات التي أصبحت بدون أي روابط قيم (أيتام) بعد الحذف
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
        // لو كل المتغيرات راح تُحذف، اترك الأقدم كـ main
        const willDeleteAll = orphanVariantIds.length === variantIdsAll.length;
        let toDelete = orphanVariantIds;
        if (willDeleteAll && variantIdsAll.length > 0) {
          const keepId = variantIdsAll[0]; // الأقدم = main
          toDelete = orphanVariantIds.filter((id) => id !== keepId);
        }

        if (toDelete.length) {
          // 3.a حذف حركات المخزون
          const { error: delInvTx } = await db
            .from("variant_inventory_transactions")
            .delete()
            .in("variant_id", toDelete);
          if (delInvTx)
            return fail(delInvTx.message, 400, {
              where: "delete/variant_inventory_transactions",
            });

          // 3.b حذف سجلات المخزون
          const { error: delInv } = await db
            .from("variant_inventory")
            .delete()
            .in("variant_id", toDelete);
          if (delInv)
            return fail(delInv.message, 400, {
              where: "delete/variant_inventory",
            });

          // 3.c حذف الأسعار
          const { error: delPrices } = await db
            .from("variant_prices")
            .delete()
            .in("variant_id", toDelete);
          if (delPrices)
            return fail(delPrices.message, 400, {
              where: "delete/variant_prices",
            });

          // 3.d حذف أي روابط متبقية احتياطًا
          const { error: delLinksOrphans } = await db
            .from("variant_option_values")
            .delete()
            .in("variant_id", toDelete);
          if (delLinksOrphans)
            return fail(delLinksOrphans.message, 400, {
              where: "delete/variant_option_values/byVariant",
            });

          // 3.e حذف المتغيرات نفسها
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

    // 4) حذف قيمة الخيار نفسها (نهائيًا)
    const { error: delVal } = await db
      .from("product_option_values")
      .delete()
      .eq("id", valueId);
    if (delVal)
      return fail(delVal.message, 400, {
        where: "delete/product_option_values",
      });

    return ok({
      message:
        "Option value deleted permanently. Orphan variants cleaned (preserving main if needed).",
      removed_variant_ids: orphanVariantIds,
    });
  } catch (e: any) {
    return fail(e?.message || "DELETE failed", 500);
  }
}
