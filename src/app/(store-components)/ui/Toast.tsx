"use client";
import * as React from "react";

type ToastMsg = { id: string; text: string };

export default function Toast() {
  const [msgs, setMsgs] = React.useState<ToastMsg[]>([]);

  React.useEffect(() => {
    const onShow = (e: Event) => {
      // @ts-expect-error CustomEvent
      const text: string = e?.detail || "";
      if (!text) return;
      const id = crypto.randomUUID();
      setMsgs((xs) => [...xs, { id, text }]);

      // الإخفاء التلقائي بعد 2.5s (نفس سلوكك)
      setTimeout(() => {
        setMsgs((xs) => xs.filter((m) => m.id !== id));
      }, 2500);
    };
    window.addEventListener("toast:show", onShow as EventListener);
    return () => window.removeEventListener("toast:show", onShow as EventListener);
  }, []);

  if (msgs.length === 0) return null;

  return (
    <div className="fixed top-4 left-4 z-[1000] space-y-2">
      {msgs.map((m) => (
        <ToastItem
          key={m.id}
          msg={m}
          onClose={() => setMsgs((xs) => xs.filter((x) => x.id !== m.id))}
        />
      ))}
    </div>
  );
}

/* عنصر التوست المفرد مع شريط زمني */
function ToastItem({
  msg,
  onClose,
  duration = 2500,
}: {
  msg: ToastMsg;
  onClose: () => void;
  duration?: number;
}) {
  const [pct, setPct] = React.useState(100);

  React.useEffect(() => {
    let raf = 0;
    const t0 = performance.now();

    const tick = (t: number) => {
      const elapsed = t - t0;
      const p = Math.max(0, 100 - (elapsed / duration) * 100);
      setPct(p);
      if (elapsed < duration) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration]);

  return (
    <div
      className="relative w-fit min-w-[280px] max-w-[92vw] rounded-md bg-emerald-600 text-white shadow-md ring-1 ring-emerald-700"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 px-3 py-2">
        {/* زر إغلاق (يسار) */}
        <button
          onClick={onClose}
          className="grid h-5 w-5 place-items-center rounded text-white/90 hover:text-white focus:outline-none"
          aria-label="إغلاق"
          type="button"
        >
          <span className="block leading-none text-sm">×</span>
        </button>

        {/* النص */}
        <div className="flex-1 text-sm font-semibold whitespace-pre-line">
          {msg.text}
        </div>

        {/* دائرة الصح (يمين) */}
        <div className="grid h-6 w-6 place-items-center rounded-full border border-white/90">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 fill-none stroke-white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      </div>

      {/* الشريط الزمني للاختفاء */}
      <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-700/60 overflow-hidden rounded-b-[4px]">
        <div
          className="h-full bg-white/90"
          style={{
            width: `${pct}%`,
            transition: "width 80ms linear",
          }}
        />
      </div>
    </div>
  );
}
