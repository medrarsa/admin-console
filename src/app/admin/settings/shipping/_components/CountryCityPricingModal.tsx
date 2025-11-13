// src/app/admin/settings/shipping/_components/CountryCityPricingModal.tsx
"use client";
import * as React from "react";

/** أنواع بسيطة */
type Country = { id: string; name: string };
type City = { id: string; name: string };
type Row = { city_id: string; city_name: string; fee: number | "" };

export default function CountryCityPricingModal({
  methodId,
  onClose,
}: {
  methodId: string; // 👈 نشتغل على طريقة الشحن مباشرة
  onClose: () => void;
}) {
  const [countries, setCountries] = React.useState<Country[]>([]);
  const [countryId, setCountryId] = React.useState<string>("");

  const [cities, setCities] = React.useState<City[]>([]);
  const [query, setQuery] = React.useState("");

  const [rows, setRows] = React.useState<Row[]>([]); // المدن المختارة + السعر
  const [bulkFee, setBulkFee] = React.useState<number | "">("");

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  /* 1) البلدان */
  React.useEffect(() => {
    (async () => {
      const r = await fetch("/api/admin/geo/countries", { cache: "no-store" })
        .then((x) => x.json())
        .catch(() => ({ data: [] }));
      setCountries(r?.data ?? []);
    })();
  }, []);

  /* 2) مدن البلد + prefill الأسعار الحالية للطريقة */
  React.useEffect(() => {
    if (!countryId) {
      setCities([]);
      setRows([]);
      return;
    }
    (async () => {
      setLoading(true);
      const [cs, cp] = await Promise.all([
        fetch(`/api/admin/geo/cities?country_id=${countryId}`, {
          cache: "no-store",
        })
          .then((x) => x.json())
          .catch(() => ({ data: [] })),
        fetch(
          `/api/admin/shipping/city-prices?method_id=${methodId}&country_id=${countryId}`,
          { cache: "no-store" }
        )
          .then((x) => x.json())
          .catch(() => ({ data: [] })),
      ]);

      const list: City[] = cs?.data ?? [];
      const map = new Map<string, number>(
        (
          (cp?.data ?? []) as Array<{
            city_id: string;
            base_fee: number | string;
          }>
        ).map((x) => [String(x.city_id), Number(x.base_fee)])
      );

      setCities(list);
      setRows(
        list.map((c) => ({
          city_id: String(c.id),
          city_name: String(c.name),
          fee: map.has(String(c.id)) ? map.get(String(c.id))! : ("" as ""),
        }))
      );
      setBulkFee("");
      setLoading(false);
    })();
  }, [countryId, methodId]);

  /* 3) أدوات واجهة */
  const filtered = React.useMemo(() => {
    const q = query.trim();
    if (!q) return rows;
    return rows.filter((r) => r.city_name.includes(q));
  }, [rows, query]);

  const setFee = (cityId: string, val: number | "") =>
    setRows((xs) =>
      xs.map((r) => (r.city_id === cityId ? { ...r, fee: val } : r))
    );

  const applyBulk = () => {
    if (bulkFee === "") return;
    setRows((xs) =>
      xs.map((r) => ({ ...r, fee: r.fee === "" ? Number(bulkFee) : r.fee }))
    );
  };

  /* 4) حفظ (upsert) */
  const save = async () => {
    setSaving(true);
    try {
      const items = rows
        .filter((r) => r.fee !== "" && Number(r.fee) >= 0)
        .map((r) => ({ city_id: r.city_id, base_fee: Number(r.fee) }));
      if (items.length > 0) {
        await fetch("/api/admin/shipping/city-prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method_id: methodId, items }),
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  /* 5) واجهة المستخدم */
  return (
    <div className="space-y-4" dir="rtl">
      {/* اختيار البلد + سعر جماعي */}
      <div className="grid md:grid-cols-3 gap-3">
        <label className="block md:col-span-1">
          <div className="mb-1 text-sm">البلد</div>
          <select
            className="w-full rounded-lg border px-3 py-2"
            value={countryId}
            onChange={(e) => setCountryId(e.target.value)}
          >
            <option value="">— اختر بلد —</option>
            {countries.map((co) => (
              <option key={co.id} value={co.id}>
                {co.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block md:col-span-2">
          <div className="mb-1 text-sm">تعيين سعر جماعي (للفارغ فقط)</div>
          <div className="flex items-center gap-2">
            <input
              className="w-40 rounded-lg border px-3 py-2 text-left"
              type="number"
              value={bulkFee === "" ? "" : (bulkFee as number)}
              onChange={(e) =>
                setBulkFee(e.target.value === "" ? "" : Number(e.target.value))
              }
              disabled={!countryId}
            />
            <button
              className="rounded-lg px-3 py-2 border hover:bg-zinc-50 disabled:opacity-50"
              onClick={applyBulk}
              disabled={!countryId || bulkFee === ""}
            >
              تطبيق
            </button>
          </div>
        </label>
      </div>

      {/* بحث + جدول المدن */}
      <div className="rounded-2xl border overflow-hidden">
        <div className="px-3 py-2 bg-zinc-50 border-b flex items-center justify-between">
          <span className="font-medium">مدن البلد (سعر كل مدينة)</span>
          <input
            className="rounded-lg border px-2 py-1 text-sm"
            placeholder="بحث مدينة…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={!countryId}
          />
        </div>

        {loading ? (
          <div className="p-3 text-sm text-zinc-500">يُحمّل…</div>
        ) : !countryId ? (
          <div className="p-3 text-sm text-zinc-500">اختر بلدًا لعرض مدنه.</div>
        ) : filtered.length === 0 ? (
          <div className="p-3 text-sm text-zinc-500">لا توجد مدن.</div>
        ) : (
          <div className="max-h-[50vh] overflow-auto divide-y">
            {filtered.map((r) => (
              <div
                key={r.city_id}
                className="flex items-center justify-between p-3"
              >
                <span className="truncate">{r.city_name}</span>
                <span className="flex items-center gap-2">
                  <input
                    type="number"
                    className="w-28 rounded-lg border px-2 py-1 text-left"
                    value={r.fee === "" ? "" : (r.fee as number)}
                    onChange={(e) =>
                      setFee(
                        r.city_id,
                        e.target.value === ""
                          ? ("" as "")
                          : Number(e.target.value)
                      )
                    }
                  />
                  <span className="text-sm text-zinc-600">رس</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* أزرار */}
      <div className="flex justify-end gap-2">
        <button
          className="rounded-xl px-4 py-2 border"
          onClick={onClose}
          disabled={saving}
        >
          إلغاء
        </button>
        <button
          className="rounded-xl px-4 py-2 bg-zinc-900 text-white disabled:opacity-60"
          onClick={save}
          disabled={saving || !countryId}
        >
          {saving ? "يحفظ…" : "حفظ"}
        </button>
      </div>
    </div>
  );
}
