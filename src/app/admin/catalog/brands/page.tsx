"use client";

import * as React from "react";
import BrandDialog from "./_dialogs/BrandDialog";

/* ========= Types ========= */
type SEO = { id?: string; slug?: string; meta_title?: string|null; meta_description?: string|null; is_active?: boolean; } | null;
type BrandRow = {
  id: string;
  name: string;
  description?: string | null;
  logo?: string | null;
  banner?: string | null;
  ar_char?: string | null;
  en_char?: string | null;
  is_active: boolean;
  seo?: SEO;
};
type ListResp = { data: BrandRow[]; page: number; per: number; total: number };

/* ========= helpers ========= */
async function fetchBrands(params: { q?: string; char?: string; active?: "true"|"false"; page?: number; per?: number; }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.char) sp.set("char", params.char);
  if (params.active) sp.set("active", params.active);
  if (params.page) sp.set("page", String(params.page));
  if (params.per) sp.set("per", String(params.per));
  const res = await fetch(`/api/admin/brands?${sp.toString()}`, { headers: { "x-app-role":"admin" }, cache:"no-store" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as ListResp;
}

async function patchBrand(id: string, patch: Partial<BrandRow>) {
  const res = await fetch(`/api/admin/brands/${id}`, {
    method: "PATCH", headers: { "content-type":"application/json", "x-app-role":"admin" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function deleteBrand(id: string, force = true) {
  const res = await fetch(`/api/admin/brands/${id}?force=${force ? "true" : "false"}`, {
    method: "DELETE",
    headers: { "x-app-role":"admin" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ========= Page ========= */
export default function AdminBrandsPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string|null>(null);
  const [items, setItems] = React.useState<BrandRow[]>([]);
  const [q, setQ] = React.useState(""); const [char, setChar] = React.useState("");
  const [active, setActive] = React.useState<""|"true"|"false">(""); const [page, setPage] = React.useState(1);
  const per = 24; const [total, setTotal] = React.useState(0);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<BrandRow | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try { const resp = await fetchBrands({ q, char, active: active || undefined, page, per });
      setItems(resp.data); setTotal(resp.total);
    } catch (e: any) { setError(e?.message || "Error"); }
    finally { setLoading(false); }
  }, [q, char, active, page]);
  React.useEffect(() => { load(); }, [load]);

  const onToggle = async (b: BrandRow) => {
    const prev = [...items];
    setItems(list => list.map(x => x.id === b.id ? ({ ...x, is_active: !x.is_active }) : x));
    try { await patchBrand(b.id, { is_active: !b.is_active }); }
    catch (e:any) { setItems(prev); alert(e?.message || "فشل التحديث"); }
  };

  const letters = ["أ","ا","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز","س","ش","ص","ض","ط","ظ","ع","غ","ف","ق","ك","ل","م","ن","ه","و","ي"];
  const totalPages = Math.max(1, Math.ceil(total / per));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <button onClick={() => { setEditing(null); setDialogOpen(true); }} className="rounded-xl px-4 py-2 bg-emerald-600 text-white w-full md:w-auto">+ إضافة ماركة</button>

        <select value={active} onChange={(e)=>{ setActive(e.target.value as any); setPage(1); }} className="rounded-xl border px-3 py-2 md:ms-auto w-full md:w-64">
          <option value="">الكل (مفعّل/معطّل)</option><option value="true">مفعّل فقط</option><option value="false">معطّل فقط</option>
        </select>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={()=>{ setChar(""); setPage(1); }} className={`px-3 py-2 rounded-lg border ${char===""?"bg-black text-white":""}`}>الكل</button>
          {letters.map(L => (
            <button key={L} onClick={()=>{ setChar(L); setPage(1); }} className={`px-2.5 py-1.5 rounded-lg border ${char===L?"bg-black text-white":""}`} title={L}>{L}</button>
          ))}
        </div>

        <input value={q} onChange={(e)=>{ setPage(1); setQ(e.target.value); }} placeholder="بحث باسم الماركة..." className="w-full md:w-72 rounded-xl border px-3 py-2 outline-none focus:ring-2"/>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="animate-pulse rounded-2xl border px-6 py-4">جاري التحميل...</div></div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-gray-500">لا توجد نتائج.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((b) => {
            const raw = b.logo?.trim() || "";
            // تأكد من تركيب الرابط بشكل سليم (يدعم /public و http)
            const logo = raw ? (raw.startsWith("http") ? raw : (raw.startsWith("/") ? raw : `/${raw}`)).replaceAll("\\","/") : "";
            const hasLogo = logo.length > 1;
            return (
              <div key={b.id} className="rounded-2xl border p-4 flex flex-col gap-3 relative">
                <span className={`absolute top-2 end-2 text-[10px] px-2 py-0.5 rounded-full border ${hasLogo ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                  {hasLogo ? "Logo ✓" : "No Logo"}
                </span>

                <div className="flex items-center gap-3">
                  <div className="size-14 rounded-xl bg-gray-50 overflow-hidden flex items-center justify-center">
                    {hasLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logo} alt={b.name} className="object-contain max-h-14" />
                    ) : (
                      <span className="text-xs text-gray-400">No Logo</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{b.name}</div>
                    <div className="text-xs text-gray-500">{b.seo?.slug ? `/${b.seo.slug}` : "—"}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setEditing(b); setDialogOpen(true); }} className="text-sm underline">تعديل</button>
                    <button
                      onClick={async () => {
                        if (!confirm(`حذف الماركة "${b.name}"؟ سيتم فك الارتباط عن المنتجات.`)) return;
                        try { await deleteBrand(b.id, true); await load(); }
                        catch (e:any) { alert(`فشل الحذف: ${e?.message || ""}`); }
                      }}
                      className="text-sm text-red-600 underline"
                    >
                      حذف
                    </button>
                  </div>

                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={b.is_active} onChange={() => onToggle(b)} className="peer sr-only" />
                    <span className="w-11 h-6 rounded-full bg-gray-300 peer-checked:bg-emerald-500 transition-colors relative">
                      <span className="absolute top-0.5 start-0.5 w-5 h-5 bg-white rounded-full shadow transition-all peer-checked:translate-x-5" />
                    </span>
                    <span className="text-sm">{b.is_active ? "مفعّل" : "معطّل"}</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2 pt-4">
        <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-2 rounded-lg border disabled:opacity-40">السابق</button>
        <div className="text-sm">صفحة {page} من {Math.max(1, Math.ceil(total / per))}</div>
        <button disabled={page >= Math.max(1, Math.ceil(total / per))} onClick={() => setPage(p => p + 1)} className="px-3 py-2 rounded-lg border disabled:opacity-40">التالي</button>
      </div>

      <BrandDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initial={editing ? {
          id: editing.id, name: editing.name, description: editing.description ?? "",
          logo: editing.logo ?? "", banner: editing.banner ?? "",
          ar_char: editing.ar_char ?? "", en_char: editing.en_char ?? "",
          is_active: editing.is_active,
          seo: editing.seo ? {
            slug: editing.seo.slug || "", meta_title: editing.seo.meta_title || "",
            meta_description: editing.seo.meta_description || "", is_active: editing.seo.is_active ?? true,
          } : { slug: "", meta_title: "", meta_description: "", is_active: true },
        } : null}
        onSaved={() => { setDialogOpen(false); setEditing(null); load(); }}
      />
    </div>
  );
}
