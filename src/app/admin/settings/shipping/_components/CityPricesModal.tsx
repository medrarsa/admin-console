"use client";
import * as React from "react";

type Country = { id: string; name: string; code?: string };
type City = { id: string; name: string };
type Row = { city_id: string; city_name: string; fee: number | "" };

export default function CountryCityPricingModal({
  methodId,
  onClose,
}: {
  methodId: string;
  onClose: () => void;
}) {
  const [countries, setCountries] = React.useState<Country[]>([]);
  const [countryId, setCountryId] = React.useState<string>("");

  const [cities, setCities] = React.useState<City[]>([]);
  const [query, setQuery] = React.useState("");

  const [selected, setSelected] = React.useState<Row[]>([]);
  const [bulkFee, setBulkFee] = React.useState<number | "">("");

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  /* ---------- load countries ---------- */
  React.useEffect(() => {
    (async () => {
      const r = await fetch("/api/admin/geo/countries", { cache: "no-store" })
        .then((x) => x.json())
        .catch(() => ({ data: [] }));
      setCountries(r?.data ?? []);
    })();
  }, []);

  /* ---------- load cities + prefill existing prices ---------- */
  React.useEffect(() => {
    if (!countryId) {
      setCities([]);
      setSelected([]);
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
        (cp?.data ?? []).map((x: any) => [
          String(x.city_id),
          Number(x.base_fee),
        ])
      );
      setCities(list);
      setSelected(
        list
          .filter((c) => map.has(String(c.id)))
          .map((c) => ({
            city_id: String(c.id),
            city_name: c.name,
            fee: map.get(String(c.id))!,
          }))
      );
      setBulkFee("");
      setLoading(false);
    })();
  }, [countryId, methodId]);

  /* ---------- helpers ---------- */
  const filtered = React.useMemo(() => {
    const q = query.trim();
    if (!q) return cities;
    return cities.filter((c) => c.name.includes(q));
  }, [cities, query]);

  const isSelected = (id: string) => selected.some((s) => s.city_id === id);

  const addCity = (c: City) => {
    if (isSelected(c.id)) return;
    setSelected((xs) => [
      ...xs,
      { city_id: String(c.id), city_name: c.name, fee: "" as "" },
    ]);
  };

  const removeCity = (id: string) => {
    setSelected((xs) => xs.filter((s) => s.city_id !== id));
  };

  const toggleAll = (check: boolean) => {
    if (check) {
      // أضف كل الموجودين في القائمة المفلترة
      const setIds = new Set(selected.map((s) => s.city_id));
      const extra: Row[] = filtered
        .filter((c) => !setIds.has(String(c.id)))
        .map((c) => ({
          city_id: String(c.id),
          city_name: c.name,
          fee: "" as "",
        }));
      setSelected((xs) => [...xs, ...extra]);
    } else {
      // احذف كل المفلترين من المختار
      const del = new Set(filtered.map((c) => String(c.id)));
      setSelected((xs) => xs.filter((s) => !del.has(s.city_id)));
    }
  };

  const applyBulk = () => {
    if (bulkFee === "") return;
    setSelected((xs) =>
      xs.map((r) => ({ ...r, fee: r.fee === "" ? Number(bulkFee) : r.fee }))
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const items = selected
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

  /* ---------- UI ---------- */
  return (
    <div className="space-y-4" dir="rtl">
      {/* Country Select */}
      <div className="grid md:grid-cols-3 gap-3">
        <label className="md:col-span-1 block">
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

        {/* bulk price */}
        <label className="md:col-span-2 block">
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

      {/* Two panes */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Cities list */}
        <div className="rounded-2xl border overflow-hidden">
          <div className="px-3 py-2 bg-zinc-50 border-b flex items-center justify-between">
            <span className="font-medium">مدن البلد</span>
            <div className="flex items-center gap-2">
              <input
                className="rounded-lg border px-2 py-1 text-sm"
                placeholder="بحث…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                className="rounded-lg px-2 py-1 border text-xs hover:bg-zinc-50"
                onClick={() => toggleAll(true)}
                disabled={!countryId || loading || filtered.length === 0}
              >
                تحديد الكل
              </button>
              <button
                className="rounded-lg px-2 py-1 border text-xs hover:bg-zinc-50"
                onClick={() => toggleAll(false)}
                disabled={!countryId || loading || filtered.length === 0}
              >
                إلغاء الكل
              </button>
            </div>
          </div>
          <div className="max-h-[48vh] overflow-auto divide-y">
            {loading ? (
              <div className="p-3 text-sm text-zinc-500">يُحمّل…</div>
            ) : filtered.length === 0 ? (
              <div className="p-3 text-sm text-zinc-500">لا توجد مدن.</div>
            ) : (
              filtered.map((c) => {
                const checked = isSelected(String(c.id));
                return (
                  <label
                    key={c.id}
                    className="flex items-center justify-between p-3 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          e.target.checked
                            ? addCity(c)
                            : removeCity(String(c.id))
                        }
                      />
                      <span>{c.name}</span>
                    </span>
                    {!checked && (
                      <button
                        className="rounded-lg px-3 py-1 border hover:bg-zinc-50"
                        onClick={() => addCity(c)}
                      >
                        إضافة
                      </button>
                    )}
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Selected with prices */}
        <div className="rounded-2xl border overflow-hidden">
          <div className="px-3 py-2 bg-zinc-50 border-b font-medium">
            المدن المختارة (سعّر كل مدينة)
          </div>

          {/* chips */}
          {selected.length > 0 && (
            <div className="p-3 flex flex-wrap gap-2 border-b">
              {selected.slice(0, 6).map((s) => (
                <span
                  key={s.city_id}
                  className="text-xs rounded-full bg-zinc-100 px-2 py-1"
                >
                  {s.city_name}
                </span>
              ))}
              {selected.length > 6 && (
                <span className="text-xs text-zinc-500">
                  +{selected.length - 6} مدن أخرى
                </span>
              )}
            </div>
          )}

          <div className="max-h-[48vh] overflow-auto divide-y">
            {selected.length === 0 ? (
              <div className="p-3 text-sm text-zinc-500">
                اختر مدنًا من القائمة اليسار.
              </div>
            ) : (
              selected.map((s, i) => (
                <div
                  key={s.city_id}
                  className="flex items-center justify-between p-3"
                >
                  <span className="truncate">{s.city_name}</span>
                  <span className="flex items-center gap-2">
                    <input
                      type="number"
                      className="w-28 rounded-lg border px-2 py-1 text-left"
                      value={s.fee === "" ? "" : (s.fee as number)}
                      onChange={(e) => {
                        const v =
                          e.target.value === ""
                            ? ("" as "")
                            : Number(e.target.value);
                        setSelected((xs) =>
                          xs.map((x, idx) => (idx === i ? { ...x, fee: v } : x))
                        );
                      }}
                    />
                    <span className="text-sm text-zinc-600">رس</span>
                    <button
                      className="rounded-lg px-3 py-1 border text-red-600 hover:bg-red-50"
                      onClick={() => removeCity(s.city_id)}
                    >
                      حذف
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
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
