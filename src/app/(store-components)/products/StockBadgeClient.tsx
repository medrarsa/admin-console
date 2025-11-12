// src/app/(store-components)/products/StockBadgeClient.tsx
"use client";
import * as React from "react";

type PricingPayload = {
  available_qty?: number;
  mode?: "base" | "from" | "options";
};

export default function StockBadgeClient({ initial }: { initial?: number }) {
  const [qty, setQty] = React.useState<number | null>(initial ?? null);
  const [mode, setMode] = React.useState<PricingPayload["mode"] | undefined>(
    undefined
  );

  React.useEffect(() => {
    const onSel = (e: Event) => {
      // @ts-expect-error CustomEvent
      const d: PricingPayload | undefined = e?.detail?.pricing;
      if (!d) return;
      // نخزن المود
      if (d.mode) setMode(d.mode);
      // نقرأ الكمية إن كانت رقم صالح
      const v =
        typeof d.available_qty === "number"
          ? d.available_qty
          : Number(d.available_qty);
      if (Number.isFinite(v)) setQty(v);
    };
    window.addEventListener("selection-changed", onSel as EventListener);
    return () =>
      window.removeEventListener("selection-changed", onSel as EventListener);
  }, []);

  // لا تعرض الشارة في وضع "from" (قبل اختيار المقاسات) لتجنب "نفدت" الوهمية
  if (mode === "from") return null;

  // لو ما عندنا رقم بعد، لا نعرض شيء
  if (qty == null) return null;

  const tone =
    qty <= 0
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : qty <= 5
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-emerald-50 text-emerald-700 ring-emerald-200";

  const label =
    qty <= 0 ? "غير متاح مؤقتًا" : qty === 1 ? "المتوفر: 1" : `المتوفر: ${qty}`;

  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ring-1",
        tone,
      ].join(" ")}
      title={label}
    >
      {qty <= 0 ? "نفدت" : label}
    </span>
  );
}
