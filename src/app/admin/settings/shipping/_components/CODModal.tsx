"use client";
import * as React from "react";

export default function CODModal({ onClose }: { onClose: () => void }) {
  const [min, setMin] = React.useState("20");
  const [max, setMax] = React.useState("500");
  const [maxItems, setMaxItems] = React.useState("10");
  const [blockFlagged, setBlockFlagged] = React.useState(true);

  const save = () => {
    alert(JSON.stringify({ min, max, maxItems, blockFlagged }, null, 2));
    onClose();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-3 bg-zinc-50 text-sm text-zinc-700">
        يتم تفعيل خيار الدفع عند الاستلام من خلال إعدادات شركة الشحن.
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm text-zinc-600">
            الحد الأدنى للمشتريات (اختياري) — ر.س
          </span>
          <input
            className="w-full mt-1 rounded-xl border px-3 py-2"
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-600">
            الحد الأقصى للمشتريات (اختياري) — ر.س
          </span>
          <input
            className="w-full mt-1 rounded-xl border px-3 py-2"
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-600">
            الحد الأعلى لوزن المنتجات في السلة (اختياري)
          </span>
          <input
            className="w-full mt-1 rounded-xl border px-3 py-2"
            value={maxItems}
            onChange={(e) => setMaxItems(e.target.value)}
          />
        </label>
      </div>

      <label className="flex items-center justify-between rounded-xl border p-3">
        <span>إيقاف خدمة الدفع عند الاستلام عن العملاء غير الجادين</span>
        <input
          type="checkbox"
          checked={blockFlagged}
          onChange={(e) => setBlockFlagged(e.target.checked)}
        />
      </label>

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl border px-4 py-2">
          إغلاق
        </button>
        <button
          onClick={save}
          className="rounded-xl bg-black text-white px-4 py-2"
        >
          حفظ
        </button>
      </div>
    </div>
  );
}
