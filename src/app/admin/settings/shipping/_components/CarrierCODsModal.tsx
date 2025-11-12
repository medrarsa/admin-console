"use client";
import * as React from "react";

type Rule = {
  id: string;
  carrier: string;
  region?: string;
  maxWeight?: string;
  note?: string;
};

export default function CarrierCODsModal({ onClose }: { onClose: () => void }) {
  const [rules, setRules] = React.useState<Rule[]>([
    {
      id: crypto.randomUUID(),
      carrier: "SMSA",
      region: "السعودية",
      maxWeight: "15",
    },
  ]);

  const add = () =>
    setRules((xs) => [
      ...xs,
      { id: crypto.randomUUID(), carrier: "Aramex", region: "", maxWeight: "" },
    ]);

  const save = () => {
    alert(JSON.stringify({ rules }, null, 2));
    onClose();
  };

  return (
    <div className="space-y-3">
      {rules.map((r, i) => (
        <div
          key={r.id}
          className="rounded-xl border p-3 grid sm:grid-cols-4 gap-3"
        >
          <select
            className="rounded-xl border px-3 py-2"
            value={r.carrier}
            onChange={(e) =>
              setRules((xs) =>
                xs.map((y, idx) =>
                  idx === i ? { ...y, carrier: e.target.value } : y
                )
              )
            }
          >
            {["SMSA", "Aramex", "SPL", "HandOver"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            className="rounded-xl border px-3 py-2"
            placeholder="المنطقة/المدينة"
            value={r.region || ""}
            onChange={(e) =>
              setRules((xs) =>
                xs.map((y, idx) =>
                  idx === i ? { ...y, region: e.target.value } : y
                )
              )
            }
          />
          <input
            className="rounded-xl border px-3 py-2"
            placeholder="أقصى وزن (كجم)"
            value={r.maxWeight || ""}
            onChange={(e) =>
              setRules((xs) =>
                xs.map((y, idx) =>
                  idx === i ? { ...y, maxWeight: e.target.value } : y
                )
              )
            }
          />
          <div className="flex items-center justify-end">
            <button
              onClick={() => setRules((xs) => xs.filter((_, idx) => idx !== i))}
              className="rounded-lg border px-3 py-2"
            >
              حذف
            </button>
          </div>
        </div>
      ))}
      <div className="flex justify-between">
        <button onClick={add} className="rounded-xl border px-4 py-2">
          إضافة قيد
        </button>
        <div className="flex gap-2">
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
    </div>
  );
}
