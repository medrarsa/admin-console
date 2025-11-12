"use client";
import * as React from "react";

export default function FreeShippingModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [rules, setRules] = React.useState<{ minTotal?: string }[]>([]);
  const addRule = () => setRules((xs) => [...xs, { minTotal: "" }]);
  const save = () => {
    alert(JSON.stringify({ rules }, null, 2));
    onClose();
  };
  return (
    <div className="space-y-4">
      {rules.length === 0 ? (
        <div className="text-center text-zinc-500 py-8">
          لا توجد شروط للشحن المجاني حاليًا
          <div className="mt-3">
            <button
              onClick={addRule}
              className="rounded-xl px-4 py-2 bg-emerald-600 text-white"
            >
              إضافة شرط
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((r, i) => (
            <div
              key={i}
              className="rounded-xl border p-3 grid sm:grid-cols-2 gap-3"
            >
              <label className="block">
                <span className="text-sm text-zinc-600">
                  الحد الأدنى لقيمة السلة (ر.س)
                </span>
                <input
                  className="w-full mt-1 rounded-xl border px-3 py-2"
                  value={r.minTotal || ""}
                  onChange={(e) =>
                    setRules((xs) =>
                      xs.map((y, idx) =>
                        idx === i ? { ...y, minTotal: e.target.value } : y
                      )
                    )
                  }
                  placeholder="مثال: 200"
                />
              </label>
              <div className="flex items-end justify-end">
                <button
                  onClick={() =>
                    setRules((xs) => xs.filter((_, idx) => idx !== i))
                  }
                  className="rounded-lg border px-3 py-2"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
