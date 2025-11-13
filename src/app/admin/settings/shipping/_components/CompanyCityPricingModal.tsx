// src/app/admin/settings/shipping/_components/CompanyCityPricingModal.tsx
"use client";
import * as React from "react";

/* ===================== Types ===================== */
type Country = { id: string; name: string; code?: string };
type City = { id: string; name: string };
type Row = { city_id: string; city_name: string; fee: number | "" };
type Block = {
  country_id: string;
  country_name: string;
  rows: Row[]; // المدن المعروضة (المسعّرة + التي أضفتها يدويًا)
  orig: Map<string, number>; // Snapshot للأسعار الأصلية (لتحديد المحذوف)
  q: string; // نص بحث المدن
  addCandidateId: string; // المدينة المختارة من القائمة
  addList: City[]; // قائمة مدن البلد للاختيار
};

/* ============== Company → Countries → Cities Pricing ============== */
export default function CompanyCityPricingModal({
  companyId,
  companyName,
  onClose,
}: {
  companyId: string;
  companyName?: string;
  onClose: () => void;
}) {
  const [methodId, setMethodId] = React.useState<string>(""); // طريقة "افتراضي" للشركة
  const [countries, setCountries] = React.useState<Country[]>([]); // قراءة فقط
  const [blocks, setBlocks] = React.useState<Block[]>([]); // البلدان المعروضة فقط
  const [addingCountryId, setAddingCountryId] = React.useState<string>("");

  const [booting, setBooting] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  /* ===================== Helpers (API) ===================== */

  // دول (قراءة فقط)
  const loadCountries = React.useCallback(async () => {
    const r = await fetch("/api/admin/geo/countries", { cache: "no-store" })
      .then((x) => x.json())
      .catch(() => ({ data: [] }));
    setCountries(r?.data ?? []);
  }, []);

  // مدن بلد (يدعم q اختياري)
  const fetchCountryCities = React.useCallback(
    async (countryId: string, q = ""): Promise<City[]> => {
      const url = `/api/admin/geo/cities?country_id=${countryId}${
        q ? `&q=${encodeURIComponent(q)}` : ""
      }`;
      try {
        const r = await fetch(url, { cache: "no-store" });
        const j = await r.json();
        return Array.isArray(j?.data) ? j.data : [];
      } catch {
        return [];
      }
    },
    []
  );

  // أسعار مدن بلد لطريقة محددة
  const fetchCityPricesForCountry = React.useCallback(
    async (mId: string, countryId: string) => {
      const r = await fetch(
        `/api/admin/shipping/city-prices?method_id=${mId}&country_id=${countryId}`,
        { cache: "no-store" }
      )
        .then((x) => x.json())
        .catch(() => ({ data: [] }));
      const map = new Map<string, number>(
        (
          (r?.data ?? []) as Array<{
            city_id: string;
            base_fee: number | string;
          }>
        ).map((x) => [String(x.city_id), Number(x.base_fee)])
      );
      return map;
    },
    []
  );

  // بلدان مرتبطة فعليًا (لديها أي مدينة بسعر)
  const detectLinkedCountryIds = React.useCallback(
    async (mId: string): Promise<string[]> => {
      const ids: string[] = [];
      for (const co of countries) {
        const r = await fetch(
          `/api/admin/shipping/city-prices?method_id=${mId}&country_id=${co.id}`,
          { cache: "no-store" }
        )
          .then((x) => x.json())
          .catch(() => ({ data: [] }));
        if (Array.isArray(r?.data) && r.data.length > 0) ids.push(co.id);
      }
      return ids;
    },
    [countries]
  );

  // Toast بسيط
  const toast = (msg: string) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("toast:show", { detail: msg }));
    }
  };

  /* ===================== Builders ===================== */

  // بلوك بلد مرتبط: يملأ الصفوف من الأسعار + يحمل قائمة المدن للاختيار
  const buildLinkedBlock = React.useCallback(
    async (mId: string, co: Country): Promise<Block> => {
      const [orig, allCities] = await Promise.all([
        fetchCityPricesForCountry(mId, co.id),
        fetchCountryCities(co.id, ""),
      ]);

      const nameMap = new Map<string, string>(
        allCities.map((c) => [String(c.id), c.name])
      );
      const rows: Row[] = Array.from(orig.entries()).map(([city_id, fee]) => ({
        city_id,
        city_name: nameMap.get(city_id) ?? city_id,
        fee,
      }));

      return {
        country_id: co.id,
        country_name: co.name,
        rows,
        orig,
        q: "",
        addCandidateId: "",
        addList: allCities,
      };
    },
    [fetchCityPricesForCountry, fetchCountryCities]
  );

  // بلوك بلد جديد عند الإضافة اليدوية (بدون صفوف، مع قائمة مدن جاهزة)
  const buildEmptyBlock = React.useCallback(
    async (co: Country): Promise<Block> => {
      const all = await fetchCountryCities(co.id, "");
      return {
        country_id: co.id,
        country_name: co.name,
        rows: [],
        orig: new Map(),
        q: "",
        addCandidateId: "",
        addList: all,
      };
    },
    [fetchCountryCities]
  );

  // إعادة تحميل البلدان المرتبطة من DB (بعد الحفظ)
  const reloadLinkedBlocks = React.useCallback(async () => {
    if (!methodId || countries.length === 0) return;
    const linkedIds = await detectLinkedCountryIds(methodId);
    const fresh: Block[] = [];
    for (const id of linkedIds) {
      const co = countries.find((c) => c.id === id);
      if (!co) continue;
      fresh.push(await buildLinkedBlock(methodId, co));
    }
    setBlocks(fresh);
  }, [methodId, countries, detectLinkedCountryIds, buildLinkedBlock]);

  /* ===================== Boot ===================== */
  React.useEffect(() => {
    (async () => {
      try {
        // 1) تهيئة/إيجاد طريقة "افتراضي" للشركة
        const got = await fetch(
          `/api/admin/shipping/methods?carrier_id=${companyId}`,
          { cache: "no-store" }
        )
          .then((r) => r.json())
          .catch(() => ({ data: [] }));
        let method = Array.isArray(got?.data)
          ? got.data.find((m: any) => String(m?.name) === "افتراضي")
          : null;
        if (!method) {
          const r = await fetch("/api/admin/shipping/methods", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              company_id: companyId,
              name: "افتراضي",
              allow_cod: false,
              lead_min: 2,
              lead_max: 5,
            }),
          }).then((x) => x.json());
          if (r?.success) method = r.data;
        }
        if (!method?.id) throw new Error("تعذّر تهيئة الطريقة الافتراضية");
        setMethodId(method.id);

        // 2) البلدان (قراءة فقط)
        await loadCountries();

        // 3) البلدان المرتبطة فقط
        const linkedIds = await detectLinkedCountryIds(method.id);
        const ready: Block[] = [];
        for (const id of linkedIds) {
          const co = countries.find((c) => c.id === id);
          if (!co) continue;
          ready.push(await buildLinkedBlock(method.id, co));
        }
        setBlocks(ready);
      } finally {
        setBooting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, loadCountries]);

  /* ===================== UI Actions ===================== */

  // إضافة بلد يدويًا
  const addCountry = async () => {
    if (!addingCountryId || !methodId) return;
    if (blocks.some((b) => b.country_id === addingCountryId)) {
      setAddingCountryId("");
      return;
    }
    const co = countries.find((c) => c.id === addingCountryId);
    if (!co) return;
    const block = await buildEmptyBlock(co);
    setBlocks((bs) => [...bs, block]);
    setAddingCountryId("");
  };

  // حذف بلد من الشاشة (لا يحذف DB مباشرة؛ سيحذف المدن المرتبطة عند الحفظ)
  const removeCountry = (countryId: string) =>
    setBlocks((bs) => bs.filter((b) => b.country_id !== countryId));

  // بحث مدينة وتحديث قائمة الاختيار
  const onSearchCity = async (countryId: string, q: string) => {
    const list = await fetchCountryCities(countryId, q);
    setBlocks((bs) =>
      bs.map((b) =>
        b.country_id === countryId ? { ...b, q, addList: list } : b
      )
    );
  };

  // اختيار مدينة من القائمة
  const onPickCity = (countryId: string, cityId: string) =>
    setBlocks((bs) =>
      bs.map((b) =>
        b.country_id === countryId ? { ...b, addCandidateId: cityId } : b
      )
    );

  // إضافة صف مدينة
  const addCityRow = (countryId: string) => {
    setBlocks((bs) =>
      bs.map((b) => {
        if (b.country_id !== countryId) return b;
        const cid = b.addCandidateId;
        if (!cid) return b;
        if (b.rows.some((r) => r.city_id === cid)) return b;
        const picked = b.addList.find((x) => String(x.id) === cid);
        const name = picked?.name ?? cid;
        return {
          ...b,
          rows: [...b.rows, { city_id: cid, city_name: name, fee: "" as "" }],
          addCandidateId: "",
        };
      })
    );
  };

  // حذف صف مدينة
  const removeCityRow = (countryId: string, cityId: string) =>
    setBlocks((bs) =>
      bs.map((b) =>
        b.country_id === countryId
          ? { ...b, rows: b.rows.filter((r) => r.city_id !== cityId) }
          : b
      )
    );

  // تعديل سعر مدينة
  const changeFee = (countryId: string, cityId: string, val: number | "") =>
    setBlocks((bs) =>
      bs.map((b) => {
        if (b.country_id !== countryId) return b;
        const rows = b.rows.map((r) =>
          r.city_id === cityId ? { ...r, fee: val } : r
        );
        return { ...b, rows };
      })
    );

  // حفظ: upsert للمدن ذات السعر + حذف للمدن التي كانت orig ثم أزلتها/فرّغت سعرها
  const saveAll = async () => {
    if (!methodId) return;
    setSaving(true);
    try {
      const toUpsert: Array<{ city_id: string; base_fee: number }> = [];
      const toDelete: string[] = [];

      for (const b of blocks) {
        const currentIds = new Set(b.rows.map((r) => r.city_id));

        // كل مدينة كانت orig ولم تعد موجودة الآن ⇒ حذف
        for (const [cid] of b.orig.entries()) {
          if (!currentIds.has(cid)) toDelete.push(cid);
        }
        // موجودة ولكن سعرها صار فارغ ⇒ حذف
        for (const r of b.rows) {
          if (r.fee === "" && b.orig.has(r.city_id)) toDelete.push(r.city_id);
        }
        // أي مدينة لها سعر ⇒ upsert
        for (const r of b.rows) {
          if (r.fee !== "")
            toUpsert.push({ city_id: r.city_id, base_fee: Number(r.fee) });
        }
      }

      if (toUpsert.length > 0) {
        await fetch("/api/admin/shipping/city-prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method_id: methodId, items: toUpsert }),
        });
      }
      if (toDelete.length > 0) {
        await fetch("/api/admin/shipping/city-prices", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method_id: methodId,
            city_ids: Array.from(new Set(toDelete)),
          }),
        });
      }

      // إعادة تحميل من DB لإظهار النتيجة فورًا (بدون إغلاق المودال)
      await reloadLinkedBlocks();
      toast("تم الحفظ بنجاح");
    } finally {
      setSaving(false);
    }
  };

  if (booting)
    return (
      <div className="p-4 text-sm text-zinc-500" dir="rtl">
        يُحمّل…
      </div>
    );

  const availableCountries = countries.filter(
    (c) => !blocks.some((b) => b.country_id === c.id)
  );

  /* ===================== UI ===================== */
  return (
    <div className="space-y-4" dir="rtl">
      <div className="text-sm text-zinc-500">
        الشركة: <span className="font-medium">{companyName ?? "—"}</span> • يتم
        الحفظ للمدن التي لها سعر فقط. ترك الحقل فارغ = استثناء/غير مرتبطة.
      </div>

      {/* إضافة بلد اختياري */}
      <div className="flex items-end gap-2">
        <label className="flex-1 block">
          <div className="mb-1 text-sm">إضافة بلد</div>
          <select
            className="w-full rounded-lg border px-3 py-2"
            value={addingCountryId}
            onChange={(e) => setAddingCountryId(e.target.value)}
          >
            <option value="">— اختر بلد لإضافته —</option>
            {availableCountries.map((co) => (
              <option key={co.id} value={co.id}>
                {co.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="rounded-lg px-3 py-2 border hover:bg-zinc-50 disabled:opacity-50"
          onClick={addCountry}
          disabled={!addingCountryId || !methodId}
        >
          إضافة
        </button>
      </div>

      {blocks.length === 0 && (
        <div className="text-sm text-zinc-500">لا توجد بلدان مرتبطة بعد.</div>
      )}

      {blocks.map((b) => (
        <div key={b.country_id} className="rounded-2xl border overflow-hidden">
          <div className="px-3 py-2 bg-zinc-50 border-b flex items-center justify-between">
            <span className="font-medium">{b.country_name}</span>
            <div className="flex items-center gap-2">
              <input
                className="rounded-lg border px-2 py-1 text-sm"
                placeholder="ابحث عن مدينة لإضافتها…"
                value={b.q}
                onChange={async (e) =>
                  onSearchCity(b.country_id, e.target.value)
                }
              />
              <select
                className="rounded-lg border px-2 py-1 text-sm"
                value={b.addCandidateId}
                onChange={(e) => onPickCity(b.country_id, e.target.value)}
              >
                <option value="">— اختر مدينة —</option>
                {b.addList.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                className="rounded-lg px-2 py-1 border text-xs hover:bg-zinc-50"
                onClick={() => addCityRow(b.country_id)}
                disabled={!b.addCandidateId}
              >
                إضافة مدينة
              </button>
              <button
                className="rounded-lg px-2 py-1 border text-xs text-red-600 hover:bg-red-50"
                onClick={() => removeCountry(b.country_id)}
              >
                حذف البلد
              </button>
            </div>
          </div>

          <div className="max-h-[48vh] overflow-auto divide-y">
            {b.rows.length === 0 ? (
              <div className="p-3 text-sm text-zinc-500">
                لا توجد مدن مرتبطة. أضف مدينة أعلاه.
              </div>
            ) : (
              b.rows.map((r) => (
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
                        changeFee(
                          b.country_id,
                          r.city_id,
                          e.target.value === ""
                            ? ("" as "")
                            : Number(e.target.value)
                        )
                      }
                    />
                    <span className="text-sm text-zinc-600">رس</span>
                    <button
                      className="rounded-lg px-2 py-1 border text-xs text-red-600 hover:bg-red-50"
                      onClick={() => removeCityRow(b.country_id, r.city_id)}
                    >
                      حذف المدينة
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      ))}

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
          onClick={saveAll}
          disabled={saving || blocks.length === 0}
        >
          {saving ? "يحفظ…" : "حفظ الكل"}
        </button>
      </div>
    </div>
  );
}
