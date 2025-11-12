// app/(store-components)/filters/FiltersPanel.tsx
"use client";
import * as React from "react";

type Filters = { q?: string; cat?: string; brand?: string };
type Props = { value: Filters; onChange: (f: Filters) => void };

export default function FiltersPanel({ value, onChange }: Props) {
  return (
    <aside className="p-4 rounded-2xl border h-fit sticky top-20">
      <div className="space-y-4">
        <div>
          <label className="block text-sm mb-1">بحث</label>
          <input
            className="w-full h-10 px-3 rounded-lg border outline-none"
            placeholder="ابحث بالاسم أو الكود…"
            value={value.q ?? ""}
            onChange={(e) =>
              onChange({ ...value, q: e.target.value || undefined })
            }
          />
        </div>
        <div>
          <label className="block text-sm mb-1">الماركة</label>
          <select
            className="w-full h-10 px-3 rounded-lg border"
            value={value.brand ?? ""}
            onChange={(e) =>
              onChange({ ...value, brand: e.target.value || undefined })
            }
          >
            <option value="">الكل</option>
            <option value="Toyota">Toyota</option>
            <option value="Lexus">Lexus</option>
            <option value="Denso">Denso</option>
          </select>
        </div>
        <button
          className="w-full h-10 rounded-lg bg-black text-white"
          onClick={() => onChange({})}
        >
          تصفير الفلاتر
        </button>
      </div>
    </aside>
  );
}
