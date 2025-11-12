// src/app/(store-components)/products/FreeShippingBarClient.tsx
"use client";
import * as React from "react";
import { moneySAR } from "@/lib/price";

/** ألوان ناعمة */
const BAR_SOLID = "#22c55e"; // أخضر أساسي
const BAR_SOFT = "#86efac";  // أخضر أفتح

export default function FreeShippingBarClient({
  needed,
  initialCurrent,
}: {
  needed: number;
  initialCurrent: number;
}) {
  const [current, setCurrent] = React.useState(initialCurrent);
  const barRef = React.useRef<HTMLDivElement>(null);
  const [isRTL, setIsRTL] = React.useState(false);

  // استقبال تغيّر السعر/المجموع من OptionsPicker (لا نلمس العقد)
  React.useEffect(() => {
    const onSel = (e: Event) => {
      // @ts-expect-error: CustomEvent
      const d = e?.detail?.pricing;
      const v = typeof d?.display === "number" ? d.display : Number(d?.display);
      if (Number.isFinite(v)) setCurrent(v);
    };
    window.addEventListener("selection-changed", onSel as EventListener);
    return () =>
      window.removeEventListener("selection-changed", onSel as EventListener);
  }, []);

  // معرفة اتجاه العنصر (RTL/LTR)
  React.useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const dir = getComputedStyle(el).direction;
    setIsRTL(dir === "rtl");
  }, []);

  const safeNeeded = needed > 0 ? needed : 0.00001;
  const remain = Math.max(0, needed - current);
  const pct = Math.min(100, Math.max(0, Math.round((current / safeNeeded) * 100)));
  const reached = remain <= 0;

  // تدرّج متوافق مع الاتجاه حتى يتحرك للأمام دائمًا
  const gradient =
    isRTL
      ? `linear-gradient(270deg, ${BAR_SOLID}, ${BAR_SOFT})`
      : `linear-gradient(90deg, ${BAR_SOLID}, ${BAR_SOFT})`;

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white/70 p-3 shadow-sm backdrop-blur md:p-4">
      {/* العنوان */}
      <div className="mb-2 flex items-center justify-between text-[12px] text-zinc-700" dir="rtl">
        <span>
          {reached
            ? "أهلًا! شحنك صار مجاني 🎉"
            : `تبقّى ${moneySAR(remain, 0)} للشحن المجاني`}
        </span>
        <span className="rounded-full border border-zinc-200 bg-white/80 px-2 py-0.5 text-[11px] text-zinc-600">
          {pct}%
        </span>
      </div>

      {/* الشريط (أنعم) */}
      <div ref={barRef} className="relative h-1.5 w-full overflow-visible">
        {/* الخلفية */}
        <div className="absolute inset-0 rounded-full bg-zinc-200 ring-1 ring-inset ring-zinc-100" />

        {/* التعبئة مثبتة على طرف الاتجاه */}
        <div
          className="absolute inset-y-0 rounded-full transition-[width] duration-500 will-change-[width]"
          style={{
            width: `${pct}%`,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            background: gradient,
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)",
          }}
        >
          {/* الشاحنة 🚚 مربوطة بحافة التقدّم */}
          <span
            className={[
              "pointer-events-none absolute top-1/2 -translate-y-1/2 select-none",
              "text-[18px] truck-bob drop-shadow",
              reached ? "animate-bounce" : "",
            ].join(" ")}
            style={isRTL ? { left: -2 } : { right: -2 }}
            aria-hidden="true"
          >
            🚚
          </span>
        </div>
      </div>

      <div className="mt-2 text-[11px] text-zinc-500" dir="rtl">
        {reached
          ? "تم الوصول للحد المطلوب للشحن المجاني."
          : "أضف منتجات أكثر للوصول للشحن المجاني 🚚"}
      </div>

      {/* بُبّة خفيفة للشاحنة */}
      <style jsx>{`
        @keyframes truck-bob {
          0%, 100% { transform: translate3d(0, -1px, 0) rotate(-0.2deg); }
          50% { transform: translate3d(0, 1px, 0) rotate(0.2deg); }
        }
        .truck-bob {
          animation: truck-bob 1.1s ease-in-out infinite;
          display: inline-block;
        }
      `}</style>
    </div>
  );
}
