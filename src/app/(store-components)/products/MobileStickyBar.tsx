// src/app/(store-components)/products/MobileStickyBar.tsx
"use client";
import * as React from "react";

type PriceCanonical = {
  list: number;
  sale: number | null;
  label: { kind: "sale" | "single" | "range"; text: string };
};

function fmt(n?: number | null) {
  if (n == null) return "—";
  return `${new Intl.NumberFormat("ar-EG").format(n)} ر.س`;
}

type Props = {
  productId: string;
  priceCanonical: PriceCanonical;
  hasVariants: boolean; // لو فيه خيارات لازم يختار قبل الإضافة
  onAddToCart?: () => Promise<void> | void; // اختياري لو عندك دالة خارجية
};

export default function MobileStickyBar({
  productId,
  priceCanonical,
  hasVariants,
  onAddToCart,
}: Props) {
  const [busy, setBusy] = React.useState(false);
  const [hint, setHint] = React.useState<string | null>(null);

  const priceNow = priceCanonical.sale ?? priceCanonical.list;

  const handleAdd = async () => {
    if (busy) return;

    // تنبيه بسيط لو فيه خيارات ولا اختار المستخدم (الاختيار يتم من OptionsPicker)
    // هنا نفترض إنك تمنع الإرسال من الأعلى لو ما تم اختيار المتغيّر.
    if (hasVariants) {
      // نعتمد إن OptionsPicker يختار أول خيار تلقائياً، فهنا نسمح بالإضافة.
      // لو تبغى منع صارم، غيّر الشرط حسب حالتك.
    }

    try {
      setBusy(true);
      setHint(null);

      if (onAddToCart) {
        await onAddToCart();
      } else {
        // Placeholder — اربطه بـ API السلة عندك لاحقًا
        await new Promise((r) => setTimeout(r, 500));
      }

      setHint("تمت الإضافة للسلة ✔");
      setTimeout(() => setHint(null), 1800);
    } catch {
      setHint("تعذّرت الإضافة، حاول لاحقًا.");
      setTimeout(() => setHint(null), 2200);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70 lg:hidden">
      <div className="mx-auto flex max-w-screen-md items-center justify-between gap-3 px-4 py-3">
        {/* السعر المختصر */}
        <div className="min-w-0">
          <div className="text-sm text-zinc-500 truncate">
            {priceCanonical.label?.text || ""}
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-xl font-bold">{fmt(priceNow)}</div>
            {priceCanonical.sale != null && (
              <div className="text-xs line-through text-zinc-400">
                {fmt(priceCanonical.list)}
              </div>
            )}
          </div>
        </div>

        {/* زر الإضافة */}
        <button
          type="button"
          onClick={handleAdd}
          disabled={busy}
          className="shrink-0 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
          aria-label="إضافة إلى السلة"
        >
          {busy ? "جارٍ الإضافة..." : "أضِفه إلى السلة"}
        </button>
      </div>

      {/* تنبيه خفيف */}
      {hint && (
        <div className="mx-auto max-w-screen-md px-4 pb-3 text-center text-xs text-emerald-700">
          {hint}
        </div>
      )}
    </div>
  );
}
