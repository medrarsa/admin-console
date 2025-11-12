// src/app/admin/settings/countries/page.tsx
"use client";

import * as React from "react";
import {
  Plus, MapPin, X, Loader2, Check, Trash2, Pencil, Power, Search,
} from "lucide-react";
import { Input } from "@/components/ui/input"; // لا نستخدم Button نهائيًا لتجنب تعارض نوع Variant

/* ========= Modal بسيط ========= */
function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "40rem",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4" role="dialog" aria-modal="true">
        <div className="w-full rounded-2xl bg-white shadow-xl ring-1 ring-black/5" style={{ maxWidth }} dir="rtl">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="font-semibold">{title}</div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-100"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ========= زر حفظ (بدون shadcn Button) ========= */
function SaveBtn({
  pending,
  ok,
  children = "حفظ",
}: {
  pending: boolean;
  ok: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-70 gap-2"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : ok ? <Check className="h-4 w-4" /> : null}
      <span>{ok ? "تم" : children}</span>
    </button>
  );
}

/* ========= Types ========= */
type CityRow = { id: string; name: string; is_active?: boolean };
type CountryRow = { id: string; name: string; code?: string | null; is_active?: boolean; cities?: CityRow[] };

/* ========= الصفحة ========= */
export default function CountriesPage() {
  const [countries, setCountries] = React.useState<CountryRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [openAddCountry, setOpenAddCountry] = React.useState(false);
  const [editCountry, setEditCountry] = React.useState<CountryRow | null>(null);
  const [citiesMgrFor, setCitiesMgrFor] = React.useState<CountryRow | null>(null);

  const [countryName, setCountryName] = React.useState("");
  const [countryCode, setCountryCode] = React.useState("");

  const [savingCountry, setSavingCountry] = React.useState(false);
  const [savedCountry, setSavedCountry] = React.useState(false);
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [savedEdit, setSavedEdit] = React.useState(false);

  const fetchCountries = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/geo/countries", { cache: "no-store" });
      const j = await r.json();
      if (j?.success) setCountries(j.data as CountryRow[]);
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => { fetchCountries(); }, [fetchCountries]);

  /* ===== Countries CRUD ===== */

  async function onAddCountry(e: React.FormEvent) {
    e.preventDefault();
    if (!countryName.trim()) return;
    try {
      setSavingCountry(true);
      const r = await fetch("/api/admin/geo/countries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: countryName.trim(), code: countryCode.trim() || null }),
      });
      const j = await r.json();
      if (j?.success) {
        setSavedCountry(true);
        setCountryName(""); setCountryCode("");
        await fetchCountries();
        window.dispatchEvent(new CustomEvent("toast:show", { detail: "تمت إضافة البلد ✅" }));
        setTimeout(() => { setSavedCountry(false); setOpenAddCountry(false); }, 900);
      } else {
        window.dispatchEvent(new CustomEvent("toast:show", { detail: `خطأ: ${j?.error || "فشل الإضافة"}` }));
      }
    } finally { setSavingCountry(false); }
  }

  async function toggleCountryActive(c: CountryRow) {
    await fetch(`/api/admin/geo/countries/${c.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_active: !c.is_active }),
    });
    fetchCountries();
  }

  async function deleteCountry(c: CountryRow) {
    if (!confirm(`حذف البلد "${c.name}"؟ سيتم حذف مدنه أيضًا.`)) return;
    await fetch(`/api/admin/geo/countries/${c.id}`, { method: "DELETE" });
    fetchCountries();
  }

  async function onEditCountrySave(e: React.FormEvent) {
    e.preventDefault();
    if (!editCountry) return;
    try {
      setSavingEdit(true);
      const r = await fetch(`/api/admin/geo/countries/${editCountry.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: editCountry.name,
          code: editCountry.code === "" ? null : editCountry.code,
        }),
      });
      const j = await r.json();
      if (j?.success) {
        setSavedEdit(true);
        await fetchCountries();
        window.dispatchEvent(new CustomEvent("toast:show", { detail: "تم حفظ التعديل ✅" }));
        setTimeout(() => { setSavedEdit(false); setEditCountry(null); }, 700);
      } else {
        window.dispatchEvent(new CustomEvent("toast:show", { detail: `خطأ: ${j?.error || "فشل الحفظ"}` }));
      }
    } finally { setSavingEdit(false); }
  }

  /* ===== Cities Manager (جدول داخل مودال) ===== */

  function CitiesManager({ country }: { country: CountryRow }) {
    const [rows, setRows] = React.useState<CityRow[]>(country.cities ?? []);
    const [q, setQ] = React.useState("");
    const [pending, setPending] = React.useState(false);
    const [newCity, setNewCity] = React.useState("");

    const pageSize = 12;
    const [page, setPage] = React.useState(1);
    const filtered = React.useMemo(
      () => rows.filter((x) => x.name.toLowerCase().includes(q.toLowerCase())),
      [rows, q]
    );
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
    React.useEffect(() => { setPage(1); }, [q]);

    async function addCity(name: string) {
      if (!name.trim()) return;
      setPending(true);
      const r = await fetch(`/api/admin/geo/countries/${country.id}/cities`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const j = await r.json();
      setPending(false);
      if (j?.success) {
        setRows((xs) => [{ id: j.data.id, name: j.data.name, is_active: j.data.is_active }, ...xs]);
        setNewCity("");
        window.dispatchEvent(new CustomEvent("toast:show", { detail: "أُضيفت المدينة ✅" }));
      } else {
        window.dispatchEvent(new CustomEvent("toast:show", { detail: `خطأ: ${j?.error || "فشل الإضافة"}` }));
      }
    }

    async function toggleActive(row: CityRow) {
      const r = await fetch(`/api/admin/geo/cities/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_active: !row.is_active }),
      });
      const j = await r.json();
      if (j?.success) {
        setRows((xs) => xs.map((x) => (x.id === row.id ? { ...x, is_active: !x.is_active } : x)));
      }
    }

    async function saveName(row: CityRow, name: string) {
      const r = await fetch(`/api/admin/geo/cities/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await r.json();
      if (j?.success) {
        setRows((xs) => xs.map((x) => (x.id === row.id ? { ...x, name } : x)));
      }
    }

    async function remove(row: CityRow) {
      if (!confirm(`حذف "${row.name}"؟`)) return;
      const r = await fetch(`/api/admin/geo/cities/${row.id}`, { method: "DELETE" });
      const j = await r.json();
      if (j?.success) setRows((xs) => xs.filter((x) => x.id !== row.id));
    }

    function EditableRow({ row }: { row: CityRow }) {
      const [edit, setEdit] = React.useState(false);
      const [name, setName] = React.useState(row.name);
      const [wait, setWait] = React.useState(false);

      async function commit() {
        if (name.trim() === row.name) { setEdit(false); return; }
        setWait(true);
        await saveName(row, name.trim());
        setWait(false); setEdit(false);
      }

      return (
        <tr className="border-b last:border-0">
          <td className="py-2">
            {edit ? (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && commit()}
                className="h-8"
                dir="rtl"
              />
            ) : (
              <span className="text-sm">{row.name}</span>
            )}
          </td>
          <td className="py-2 w-28">
            <span className={`text-xs inline-flex items-center rounded-full px-2 py-0.5 ${row.is_active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
              {row.is_active ? "مفعّل" : "معطّل"}
            </span>
          </td>
          <td className="py-2 w-36">
            <div className="flex gap-1 justify-end">
              <button
                title={row.is_active ? "تعطيل" : "تفعيل"}
                onClick={() => toggleActive(row)}
                className="inline-flex h-8 w-8 items-center justify-center rounded border hover:bg-zinc-50"
              >
                <Power className={`h-4 w-4 ${row.is_active ? "text-emerald-600" : "text-zinc-400"}`} />
              </button>
              {edit ? (
                <button
                  onClick={commit}
                  className="inline-flex h-8 px-3 items-center justify-center rounded border hover:bg-zinc-50 text-sm"
                >
                  {wait ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
                </button>
              ) : (
                <button
                  title="تعديل"
                  onClick={() => setEdit(true)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded border hover:bg-zinc-50"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              <button
                title="حذف"
                onClick={() => remove(row)}
                className="inline-flex h-8 w-8 items-center justify-center rounded border hover:bg-zinc-50"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </button>
            </div>
          </td>
        </tr>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن مدينة..." className="pl-9" />
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); addCity(newCity); }}
            className="flex items-center gap-2"
          >
            <Input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="مدينة جديدة" className="w-48" />
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-zinc-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              إضافة
            </button>
          </form>
        </div>

        <div className="rounded-xl border">
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-right">
              <thead className="sticky top-0 bg-zinc-50 text-xs text-zinc-600">
                <tr>
                  <th className="px-3 py-2 font-medium">المدينة</th>
                  <th className="px-3 py-2 font-medium">الحالة</th>
                  <th className="px-3 py-2 font-medium text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {visible.map((row) => <EditableRow key={row.id} row={row} />)}
                {visible.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-8 text-center text-zinc-500">لا توجد نتائج.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-3 py-2 text-sm">
            <span className="text-zinc-500">المجموع: {filtered.length}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border px-2 py-1 disabled:opacity-40"
              >
                السابق
              </button>
              <span className="text-zinc-600">{page} / {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded border px-2 py-1 disabled:opacity-40"
              >
                التالي
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ========= UI ========= */
  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">البلدان</h1>
          <p className="text-sm text-zinc-500">أضف البلدان ثم أدِر مدن كل بلد من نفس الصفحة.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpenAddCountry(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white"
        >
          <Plus className="size-4" />
          إضافة بلد
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl border border-zinc-200 bg-zinc-50 animate-pulse" />
          ))
        ) : countries.length === 0 ? (
          <div className="text-zinc-500">لا توجد بلدان بعد.</div>
        ) : (
          countries.map((c) => (
            <div key={c.id} className={`rounded-2xl border p-4 transition ${c.is_active ? "border-zinc-200" : "border-red-200 bg-red-50/30"}`}>
              <div className="flex items-center justify-between">
                <div className="font-semibold">{c.name}</div>
                <div className="flex items-center gap-2">
                  {c.code ? <span className="text-xs rounded-full border px-2 py-0.5" dir="ltr">{c.code}</span> : null}
                  <button title={c.is_active ? "تعطيل" : "تفعيل"} onClick={() => toggleCountryActive(c)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-zinc-50">
                    <Power className={`h-4 w-4 ${c.is_active ? "text-emerald-600" : "text-zinc-400"}`} />
                  </button>
                  <button title="تعديل" onClick={() => setEditCountry({ ...c })} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-zinc-50">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button title="حذف" onClick={() => deleteCountry(c)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-zinc-50">
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-zinc-500">المدن: {c.cities?.length ?? 0}</div>
                <button
                  type="button"
                  onClick={() => setCitiesMgrFor(c)}
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-zinc-50"
                >
                  <MapPin className="size-4" />
                  إدارة المدن
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* إضافة بلد */}
      <Modal open={openAddCountry} onClose={() => setOpenAddCountry(false)} title="إضافة بلد" maxWidth="36rem">
        <form onSubmit={onAddCountry} className="space-y-3">
          <div className="grid gap-2">
            <label className="text-sm">اسم البلد</label>
            <Input required value={countryName} onChange={(e) => setCountryName(e.target.value)} placeholder="مثال: اليمن" dir="rtl" />
          </div>
          <div className="grid gap-2">
            <label className="text-sm">كود البلد (اختياري)</label>
            <Input value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} placeholder="YE / SA" dir="ltr" />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpenAddCountry(false)} className="rounded-lg border px-3 py-2 text-sm hover:bg-zinc-50">إلغاء</button>
            <SaveBtn pending={savingCountry} ok={savedCountry}>حفظ</SaveBtn>
          </div>
        </form>
      </Modal>

      {/* تعديل بلد */}
      <Modal open={!!editCountry} onClose={() => setEditCountry(null)} title={editCountry ? `تعديل بلد — ${editCountry.name}` : ""} maxWidth="32rem">
        <form onSubmit={onEditCountrySave} className="space-y-3">
          <div className="grid gap-2">
            <label className="text-sm">اسم البلد</label>
            <Input value={editCountry?.name ?? ""} onChange={(e) => setEditCountry((x) => (x ? { ...x, name: e.target.value } : x))} dir="rtl" />
          </div>
          <div className="grid gap-2">
            <label className="text-sm">كود البلد</label>
            <Input value={editCountry?.code ?? ""} onChange={(e) => setEditCountry((x) => (x ? { ...x, code: e.target.value.toUpperCase() } : x))} dir="ltr" />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditCountry(null)} className="rounded-lg border px-3 py-2 text-sm hover:bg-zinc-50">إلغاء</button>
            <SaveBtn pending={savingEdit} ok={savedEdit}>حفظ</SaveBtn>
          </div>
        </form>
      </Modal>

      {/* إدارة المدن */}
      <Modal
        open={!!citiesMgrFor}
        onClose={() => { setCitiesMgrFor(null); fetchCountries(); }}
        title={citiesMgrFor ? `إدارة مدن — ${citiesMgrFor.name}` : ""}
        maxWidth="48rem"
      >
        {citiesMgrFor ? <CitiesManager country={citiesMgrFor} /> : null}
      </Modal>
    </div>
  );
}
