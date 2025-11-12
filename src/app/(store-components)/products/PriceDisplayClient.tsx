// src/app/(store-components)/products/PriceDisplayClient.tsx
"use client";
import * as React from "react";
import { moneySAR } from "@/lib/price";

/* نفس العقد الحالي عشان ما نكسر أي استخدامات */
type Pricing = {
  list: number;                 // سعر القائمة
  sale: number | null;          // سعر الخصم (إن وجد)
  display: number;              // المعروض حاليًا (قد يساوي sale أو list أو أقل متغير)
  mode: "base" | "from" | "options"; // حالة العرض
};

/* تنسيق داخلي ثابت للعملة */
const fmt = (n: number | null | undefined) =>
  n == null ? "—" : moneySAR(n, 2);

/* يحسب نسبة الخصم لو فيه خصم فعلي */
const discountBadge = (list?: number, sale?: number | null) => {
  if (
    typeof list === "number" &&
    Number.isFinite(list) &&
    sale != null &&
    typeof sale === "number" &&
    Number.isFinite(sale) &&
    sale < list
  ) {
    const prc = Math.round(((list - sale) / list) * 100);
    return `${prc}% خصم`;
  }
  return null;
};

export default function PriceDisplayClient({ initial }: { initial: Pricing }) {
  const [p, setP] = React.useState<Pricing>(initial);

  // التزام بالعقد القائم: نسمع لحدث selection-changed ونستلم { detail.pricing }
  React.useEffect(() => {
    const onSel = (e: Event) => {
      // @ts-expect-error: CustomEvent من الواجهة
      const d: Pricing | undefined = e?.detail?.pricing;
      if (d) setP(d);
    };
    window.addEventListener("selection-changed", onSel as EventListener);
    return () =>
      window.removeEventListener("selection-changed", onSel as EventListener);
  }, []);

  // شارة الخصم إن وجدت
  const badge = discountBadge(p.list, p.sale);

  // النص المساعد تحت السعر
  const hint =
    p.mode === "from"
      ? "(يبدأ من)"
      : p.mode === "base"
      ? "(سعر أساسي)"
      : "(حسب الخيارات)";

  return (
    <div className="flex items-center gap-3">
      {/* السعر الأساسي المعروض (display) */}
      <div className="text-2xl font-bold">{fmt(p.display)}</div>

      {/* إن كان فيه خصم: أظهر السعر المشطوب (list) */}
      {p.sale != null && p.sale < p.list && (
        <div className="text-sm text-zinc-400 line-through">{fmt(p.list)}</div>
      )}

      {/* شارة الخصم أو تلميح الحالة */}
      <span className="text-xs text-zinc-600">
        {badge ? badge : hint}
      </span>
    </div>
  );
}
