// src/app/(store-components)/products/NoOptionsPriceClient.tsx
"use client";
import * as React from "react";

type V = {
  id: string;
  price?: number | null;
  sale_price?: number | null;
  qty_available?: number | null;
};

export default function NoOptionsPriceClient({
  productId,
  variants,
  basePrice,
}: {
  productId: string;
  variants: V[];
  basePrice: number;
}) {
  // يبث الحدث بتأخير بسيط لضمان وجود المستمعين (ProductAddBar/PriceDisplay/FreeShipping)
  const emit = React.useCallback(
    (payload: any) => {
      const fire = () =>
        window.dispatchEvent(new CustomEvent("selection-changed", { detail: payload }));
      // 1) الإطار التالي
      requestAnimationFrame(() => {
        fire();
        // 2) ثم طابور المايكرو/التاسك التالي احتياطًا
        setTimeout(fire, 0);
      });
    },
    []
  );

  React.useEffect(() => {
    const vs = Array.isArray(variants) ? variants : [];

    // إجمالي المخزون عبر جميع المتغيرات
    const totalAvail = vs.reduce((acc, v) => acc + (v.qty_available ?? 0), 0);

    // حساب list/sale/display لكل variant
    const withDisp = vs.map((v) => {
      const list =
        typeof v.price === "number" && Number.isFinite(v.price)
          ? v.price
          : null;
      const sale =
        typeof v.sale_price === "number" && Number.isFinite(v.sale_price)
          ? v.sale_price
          : null;
      const effectiveList = list ?? basePrice;
      const effectiveSale = sale != null && sale < effectiveList ? sale : null;
      const display = effectiveSale ?? effectiveList;
      const qty = v.qty_available ?? 0;
      return {
        v,
        list: effectiveList,
        sale: effectiveSale,
        display,
        qty,
      };
    });

    // اختيار: أكبر كمية ثم أرخص عرض
    withDisp.sort((a, b) => {
      if (b.qty !== a.qty) return b.qty - a.qty;
      return a.display - b.display;
    });

    const best = withDisp[0] ?? null;

    // لو ما فيه variants إطلاقًا، نستخدم basePrice فقط
    const list = best ? best.list : basePrice;
    const sale = best ? best.sale : null;
    const display = sale ?? list;

    emit({
      product_id: productId,
      variant_id: best ? String(best.v.id) : null,
      selections: {},
      pricing: {
        list,
        sale,
        display,
        mode: "base", // منتج بلا خيارات
        available_qty: Math.max(0, totalAvail),
      },
    });
  }, [productId, variants, basePrice, emit]);

  return null;
}
