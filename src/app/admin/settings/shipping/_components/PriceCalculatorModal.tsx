"use client";
import * as React from "react";

export default function PriceCalculatorModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [weight, setWeight] = React.useState("1.0");
  const [zone, setZone] = React.useState("السعودية");
  const [carrier, setCarrier] = React.useState("SMSA");
  const [result, setResult] = React.useState<string | null>(null);

  const calc = () => {
    // حساب تقريبي وهمي
    const base = carrier === "Aramex" ? 27 : 25;
    const fee = base + Math.max(0, parseFloat(weight || "0") - 1) * 6;
    setResult(`${Math.round(fee)} ر.س`);
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-sm text-zinc-600">الوزن (كجم)</span>
          <input
            className="w-full mt-1 rounded-xl border px-3 py-2"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-600">الوجهة</span>
          <select
            className="w-full mt-1 rounded-xl border px-3 py-2"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
          >
            {["السعودية", "اليمن", "الخليج"].map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-zinc-600">شركة الشحن</span>
          <select
            className="w-full mt-1 rounded-xl border px-3 py-2"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
          >
            {["SMSA", "Aramex", "SPL"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={calc}
          className="rounded-xl bg-emerald-600 text-white px-4 py-2"
        >
          احسب الآن
        </button>
        <div className="text-lg font-semibold">
          {result ? `التكلفة: ${result}` : ""}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl border px-4 py-2">
          إغلاق
        </button>
      </div>
    </div>
  );
}
