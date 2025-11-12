// src/app/admin/products/_components/TaxonTagsField.tsx
"use client";

import * as React from "react";
import MultiTagSelect from "./MultiTagSelect";
import { X } from "lucide-react";

/* ====== Types ====== */
type FlatTaxon = {
  id: string;
  name: string;
  parent_id: string | null;
  level: "root" | "sub" | "seg";
  slug?: string;
  sort_order?: number;
  is_active?: boolean | null;
  status?: string | null;
};
type ProductTaxon = { id: string; name: string };

/* ====== Simple caches ====== */
let TAXONS_CACHE: FlatTaxon[] | null = null;
let TAXONS_PROMISE: Promise<FlatTaxon[]> | null = null;

const PROD_TAXONS_CACHE = new Map<string, ProductTaxon[]>();
const PROD_TAXONS_PROMISE = new Map<string, Promise<ProductTaxon[]>>();

const isUUID = (id?: string) =>
  !!id &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id || ""
  );

const isActiveTaxon = (t: FlatTaxon) =>
  (t.status ? t.status.toLowerCase() === "active" : true) &&
  (typeof t.is_active === "boolean" ? t.is_active : true);

async function fetchFlatTaxonsOnce(): Promise<FlatTaxon[]> {
  if (TAXONS_CACHE) return TAXONS_CACHE;
  if (TAXONS_PROMISE) return TAXONS_PROMISE;
  TAXONS_PROMISE = (async () => {
    const r = await fetch("/api/admin/taxons?flat=true", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.success) throw new Error(j?.error || `GET ${r.status}`);
    TAXONS_CACHE = ((j.data ?? []) as FlatTaxon[]).filter(isActiveTaxon);
    TAXONS_PROMISE = null;
    return TAXONS_CACHE!;
  })();
  return TAXONS_PROMISE;
}

async function fetchProductTaxonsOnce(
  productId: string
): Promise<ProductTaxon[]> {
  const cached = PROD_TAXONS_CACHE.get(productId);
  if (cached) return cached;
  const inflight = PROD_TAXONS_PROMISE.get(productId);
  if (inflight) return inflight;
  const p = (async () => {
    const r = await fetch(`/api/admin/products/${productId}`, {
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.success) throw new Error(j?.error || `GET ${r.status}`);
    const rows = (j?.data?.taxons ?? []) as ProductTaxon[];
    PROD_TAXONS_CACHE.set(productId, rows);
    PROD_TAXONS_PROMISE.delete(productId);
    return rows;
  })();
  PROD_TAXONS_PROMISE.set(productId, p);
  return p;
}

async function patchProductTaxons(productId: string, taxonIds: string[]) {
  const r = await fetch(`/api/admin/products/${productId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taxon_ids: taxonIds }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.success) throw new Error(j?.error || `PATCH ${r.status}`);
  return true;
}

/* ====== Component ====== */
export default function TaxonTagsField({
  productId,
  className,
  placeholder = "أضف تصنيف",
}: {
  productId: string;
  className?: string;
  placeholder?: string;
}) {
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const [allTaxons, setAllTaxons] = React.useState<FlatTaxon[]>([]);
  const [selectedNames, setSelectedNames] = React.useState<string[]>([]);
  const [taxonIdByName, setTaxonIdByName] = React.useState(
    new Map<string, string>()
  );
  const [nameByTaxonId, setNameByTaxonId] = React.useState(
    new Map<string, string>()
  );

  const usable = isUUID(productId);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const flat = await fetchFlatTaxonsOnce();
        if (!alive) return;

        setAllTaxons(flat);

        // خرائط اسم↔︎معرّف
        const idByName = new Map<string, string>();
        const nameById = new Map<string, string>();
        flat.forEach((t) => {
          idByName.set(t.name, t.id);
          nameById.set(t.id, t.name);
        });
        setTaxonIdByName(idByName);
        setNameByTaxonId(nameById);

        // تحميل تصنيفات المنتج (نشطة فقط)
        if (usable) {
          const prod = await fetchProductTaxonsOnce(productId);
          if (!alive) return;
          const activeNames = new Set(flat.map((t) => t.name));
          setSelectedNames(
            prod.map((t) => t.name).filter((nm) => activeNames.has(nm))
          );
        } else {
          setSelectedNames([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [productId, usable]);

  const suggestions = React.useMemo(
    () => allTaxons.map((t) => t.name),
    [allTaxons]
  );

  const namesToIds = (names: string[]) =>
    names.map((nm) => taxonIdByName.get(nm)).filter(Boolean) as string[];

  async function commit(nextNames: string[]) {
    if (!usable) return;
    const activeSet = new Set(allTaxons.map((t) => t.name));
    const sanitized = nextNames.filter((nm) => activeSet.has(nm));

    const nextIds = namesToIds(sanitized);
    const prev = selectedNames;

    setSelectedNames(sanitized);
    setSyncing(true);
    try {
      await patchProductTaxons(productId, nextIds);
      // تحديث كاش المنتج
      PROD_TAXONS_CACHE.set(
        productId,
        nextIds
          .map((id) => ({ id, name: nameByTaxonId.get(id) || "" }))
          .filter((t) => t.name)
      );
    } catch (e: any) {
      setSelectedNames(prev);
      alert(`❌ فشل تحديث الأقسام: ${e?.message || e}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleChange(next: string[]) {
    await commit(next);
  }

  async function handleRemove(name: string) {
    await commit(selectedNames.filter((n) => n !== name));
  }

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-sm text-zinc-600">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
          تحميل التصنيفات…
        </div>
      </div>
    );
  }

  /* ====== UI ====== */
  const count = selectedNames.length;

  const Chip = ({ name }: { name: string }) => (
    <span
      className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[12px] text-zinc-700 shadow-sm"
      title={name}
    >
      <span className="truncate max-w-[10rem]">{name}</span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!syncing && usable) handleRemove(name);
        }}
        className="rounded-full p-0.5 text-zinc-500 transition hover:bg-zinc-100 disabled:opacity-50"
        title="إزالة"
        aria-label={`إزالة ${name}`}
        disabled={syncing || !usable}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );

  return (
    <div className={className}>
      {/* صندوق منسّق */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-2">
        {/* الإدخال */}
        <div
          className={!usable || syncing ? "pointer-events-none opacity-60" : ""}
          aria-disabled={!usable || syncing}
        >
          <MultiTagSelect
            selected={selectedNames}
            onChange={handleChange}
            suggestions={suggestions}
            placeholder={placeholder}
          />
        </div>

        {/* شريط معلومات + زر توسيع/إخفاء */}
        <div className="mt-1 flex items-center justify-between">
          <div className="text-[11px] text-zinc-500">
            {count > 0 ? `${count} تصنيف` : "لا توجد أقسام مرتبطة"}
          </div>
          {count > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((s) => !s)}
              className="text-[12px] text-teal-700 hover:underline"
            >
              {expanded ? "إخفاء" : "عرض الكل"}
            </button>
          )}
        </div>

        {/* العرض */}
        {count > 0 &&
          (expanded ? (
            // شبكة مرتبة
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {selectedNames.map((name) => (
                <Chip key={name} name={name} />
              ))}
            </div>
          ) : (
            // وضع مضغّط: سطر واحد قابل للتمرير (بدون +N)
            <div className="mt-2 relative">
              <div
                className="flex gap-2 overflow-x-auto no-scrollbar"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {selectedNames.map((name) => (
                  <Chip key={name} name={name} />
                ))}
              </div>
              <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
              `}</style>
            </div>
          ))}

        {syncing && (
          <div className="mt-1 text-[11px] text-zinc-500">
            جارٍ تحديث الأقسام…
          </div>
        )}
      </div>
    </div>
  );
}
