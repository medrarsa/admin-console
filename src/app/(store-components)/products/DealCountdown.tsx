"use client";
import * as React from "react";
import { toEnDigits } from "@/lib/num";

type Props = {
  endsAt: string; // ISO
  label?: string; // نص قبل العدّاد (عربي)
  dense?: boolean; // حجم صغير جداً
};

export default function DealCountdown({
  endsAt,
  label = "عجّل! العرض ينتهي خلال",
  dense = true,
}: Props) {
  const [now, setNow] = React.useState(() => Date.now());
  const end = React.useMemo(() => new Date(endsAt).getTime(), [endsAt]);

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = end - now;
  if (!end || Number.isNaN(end) || diff <= 0) return null;

  const total = Math.floor(diff / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const DD = toEnDigits(String(d));
  const HH = toEnDigits(h.toString().padStart(2, "0"));
  const MM = toEnDigits(m.toString().padStart(2, "0"));
  const SS = toEnDigits(s.toString().padStart(2, "0"));

  const box = dense ? "px-2 py-1 text-[13px]" : "px-3 py-2 text-2xl";
  const unit = dense ? "text-[9px]" : "text-[10px]";

  return (
    <div
      className="
        w-full rounded-b-2xl bg-white/70 backdrop-blur-[2px]
        border-t border-white/60
      "
      role="timer"
      aria-live="polite"
    >
      {/* شريط علوي صغير بالعربي */}
      <div className="flex items-center justify-center gap-1 pt-1 text-[10px] font-medium text-red-700">
        <span>🔥</span>
        <span>{label}</span>
      </div>

      {/* DAYS · HRS · MIN · SEC — أرقام إنجليزية */}
      <div className="grid grid-cols-4 gap-1 p-1.5">
        <TimerBox value={DD} unit="يوم" box={box} unitCls={unit} highlight />
        <TimerBox value={HH} unit="ساعة" box={box} unitCls={unit} />
        <TimerBox value={MM} unit="دقيقة" box={box} unitCls={unit} />
        <TimerBox value={SS} unit="ثانية" box={box} unitCls={unit} />
      </div>
    </div>
  );
}

function TimerBox({
  value,
  unit,
  box,
  unitCls,
  highlight = false,
}: {
  value: string;
  unit: string;
  box: string;
  unitCls: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center">
      <div
        className={`flex w-full items-center justify-center rounded-lg ${box} font-semibold ${
          highlight ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-900"
        }`}
        style={{ letterSpacing: "0.2px" }}
      >
        {value}
      </div>
      <div className={`mt-0.5 ${unitCls} tracking-wider text-gray-500`}>
        {unit}
      </div>
    </div>
  );
}
