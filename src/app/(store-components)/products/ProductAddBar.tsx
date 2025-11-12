// src/app/(store-components)/products/ProductAddBar.tsx
"use client";
import * as React from "react";
import QtySelector from "./QtySelector";
import { moneySAR } from "@/lib/price";

type Pricing = {
  list: number;
  sale: number | null;
  display: number;                    // السعر المستخدم فعليًا للسطر
  mode: "base" | "from" | "options";  // منطق العرض
  available_qty?: number;             // قد تأتي تحت أسماء مختلفة من الحدث
};

export default function ProductAddBar({ productId }: { productId: string }) {
  const [qty, setQty] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const [variantId, setVariantId] = React.useState<string | null>(null);
  const [selections, setSelections] = React.useState<Record<string, string | undefined>>({});

  const [pricing, setPricing] = React.useState<Pricing | null>(null);
  const [available, setAvailable] = React.useState<number>(0);

  React.useEffect(() => {
    const onSel = (e: Event) => {
      // @ts-expect-error CustomEvent from other components
      const d = e?.detail;
      if (!d) return;

      // variantId قد يجي بأسماء مختلفة
      const vid: string | null =
        (typeof d.variant_id === "string" && d.variant_id) ||
        (typeof d.variantId === "string" && d.variantId) ||
        (typeof d.id === "string" && d.id) ||
        null;
      if (vid !== undefined) setVariantId(vid);

      if (d.selections && typeof d.selections === "object") {
        setSelections(d.selections as Record<string, string | undefined>);
      }

      if (d.pricing) {
        const pr = d.pricing as Pricing;
        setPricing(pr);

        const rawAv =
          pr.available_qty ??
          d.available_qty ??
          d.qty_available ??
          d.available ??
          0;

        const av = Number(rawAv);
        setAvailable(Number.isFinite(av) && av > 0 ? av : 0);
      }

      setQty(1);
    };

    window.addEventListener("selection-changed", onSel as EventListener);
    return () => window.removeEventListener("selection-changed", onSel as EventListener);
  }, []);

  React.useEffect(() => {
    if (available > 0 && qty > available) setQty(available);
  }, [available, qty]);

  const dec = () => setQty((n) => Math.max(1, n - 1));
  const inc = () =>
    setQty((n) => {
      const next = n + 1;
      return available ? Math.min(next, available) : next;
    });

  const hasPricing = pricing != null;
  const selectionsComplete = pricing?.mode !== "from" || !!variantId;
  const hasStock = available ? qty > 0 && qty <= available : false;
  const canAdd = !!hasPricing && selectionsComplete && hasStock && !busy;

  const unit = pricing?.display ?? 0;
  const total = unit * qty;
  const hasSale = pricing?.sale != null && pricing.sale < (pricing?.list ?? Infinity);

  const btnLabel = (() => {
    if (busy) return "جاري الإضافة…";
    if (!hasPricing) return "اختر الخيارات بالأعلى";
    if (!selectionsComplete) return "اختر الخيارات بالأعلى";
    if (!hasStock) return "غير متاح";

    if (hasSale) {
      const prevTotal = (pricing?.list ?? 0) * qty;
      return (
        <span className="flex flex-col leading-tight">
          <span>أضف • {moneySAR(total, 0)}</span>
          <span className="text-[11px] opacity-90">
            <span className="line-through mr-1">{moneySAR(prevTotal, 0)}</span>
            <span>(السابق)</span>
          </span>
        </span>
      );
    }
    if (pricing?.mode === "from") {
      return <>أضف • يبدأ من {moneySAR(total, 0)}</>;
    }
    return <>أضف • {moneySAR(total, 0)}</>;
  })();

  const add = async () => {
    if (!hasPricing) {
      window.dispatchEvent(new CustomEvent("toast:show", { detail: "اختر الخيارات أولًا" }));
      return;
    }
    if (pricing?.mode === "from" && !variantId) {
      // حماية إضافية للمنتجات التي تتطلب تحديد خيار فعلي
      window.dispatchEvent(new CustomEvent("toast:show", { detail: "حدد الخيار المطلوب قبل الإضافة" }));
      return;
    }
    if (!canAdd || !pricing) return;

    try {
      setBusy(true);

      // نفس فورمات priceCanonical المستخدم في API السلة
      const priceCanonical = {
        list: Number(pricing.list || 0),
        sale: pricing.sale != null ? Number(pricing.sale) : null,
        label: {
          kind: hasSale ? ("sale" as const) : pricing.mode === "from" ? ("range" as const) : ("single" as const),
          text: hasSale ? "خصم" : pricing.mode === "from" ? "يبدأ من" : "سعر",
        },
      };

      // لقطة للعرض داخل السلة (اختياري توسّعه لاحقًا)
      const snapshot = {
        options: Object.entries(selections || {}).map(([group, value]) => ({ group, value })),
      };

      const res = await fetch("/api/store/cart/add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId,
          variantId,
          qty,
          priceCanonical,
          snapshot,
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (res.ok && j?.success) {
        // تحديث عدّاد السلة + إشعار نجاح
        window.dispatchEvent(new CustomEvent("cart-updated", { detail: { showMini: true } }));
        window.dispatchEvent(new CustomEvent("toast:show", { detail: "تمت إضافة المنتج إلى السلة ✅" }));
      } else {
        const err = j?.error || "تعذّرت الإضافة للسلة";
        window.dispatchEvent(new CustomEvent("toast:show", { detail: String(err) }));
        console.error("[add-to-cart] failed:", err);
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent("toast:show", { detail: "مشكلة اتصال — حاول مرة أخرى" }));
      console.error("[add-to-cart] network error:", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={dec}
          disabled={qty <= 1 || busy}
          className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-200 bg-white disabled:opacity-50"
          aria-label="إنقاص"
        >
          –
        </button>
        <div
          className="grid h-10 min-w-[3rem] place-items-center rounded-xl border border-zinc-200 bg-white text-sm font-semibold"
          title={available ? `المتوفر: ${available}` : undefined}
        >
          {qty}
        </div>
        <button
          type="button"
          onClick={inc}
          disabled={(!!available && qty >= available) || busy}
          className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-200 bg-white disabled:opacity-50"
          aria-label="زيادة"
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={add}
        className="flex h-10 flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
        disabled={!canAdd}
        title={available ? `المتوفر: ${available}` : "غير متاح"}
      >
        {btnLabel}
      </button>

      <button
        type="button"
        title="إهداء"
        className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-200 bg-white"
        disabled={busy}
      >
        🎁
      </button>
      <button
        type="button"
        title="المفضلة"
        className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-200 bg-white"
        disabled={busy}
      >
        ❤
      </button>
    </div>
  );
}
