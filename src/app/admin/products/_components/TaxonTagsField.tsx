// src/app/admin/products/_components/TaxonTagsField.tsx
"use client";

import * as React from "react";
import MultiTagSelect from "./MultiTagSelect";
import { X } from "lucide-react";

type FlatTaxon = {
  id: string;
  name: string;
  parent_id: string | null;
  level: "root" | "sub" | "seg";
  slug?: string;
  sort_order?: number;
};

type ProductTaxon = { id: string; name: string };

async function fetchFlatTaxons(): Promise<FlatTaxon[]> {
  const r = await fetch("/api/admin/taxons?flat=true", { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.success) throw new Error(j?.error || `GET ${r.status}`);
  return (j.data ?? []) as FlatTaxon[];
}

async function fetchProductTaxons(productId: string): Promise<ProductTaxon[]> {
  const r = await fetch(`/api/admin/products/${productId}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.success) throw new Error(j?.error || `GET ${r.status}`);
  return (j?.data?.taxons ?? []) as ProductTaxon[];
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
  const [expanded, setExpanded] = React.useState(false); // ⬅️ وضع التوسيع/الطيّ
  const [allTaxons, setAllTaxons] = React.useState<FlatTaxon[]>([]);
  const [selectedNames, setSelectedNames] = React.useState<string[]>([]);
  const [taxonIdByName, setTaxonIdByName] = React.useState<Map<string, string>>(new Map());
  const [nameByTaxonId, setNameByTaxonId] = React.useState<Map<string, string>>(new Map());

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const [flat, prodTaxons] = await Promise.all([
          fetchFlatTaxons(),
          fetchProductTaxons(productId),
        ]);
        if (!alive) return;

        setAllTaxons(flat);

        const idByName = new Map<string, string>();
        const nameById = new Map<string, string>();
        flat.forEach((t) => {
          idByName.set(t.name, t.id);
          nameById.set(t.id, t.name);
        });
        setTaxonIdByName(idByName);
        setNameByTaxonId(nameById);

        setSelectedNames(prodTaxons.map((t) => t.name).filter(Boolean));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [productId]);

  const suggestions = React.useMemo(() => allTaxons.map((t) => t.name), [allTaxons]);

  function namesToIds(names: string[]) {
    const ids: string[] = [];
    for (const nm of names) {
      const id = taxonIdByName.get(nm);
      if (id) ids.push(id);
    }
    return ids;
  }

  async function commit(nextNames: string[]) {
    const nextIds = namesToIds(nextNames);
    const prevNames = selectedNames;

    setSelectedNames(nextNames);
    setSyncing(true);
    try {
      await patchProductTaxons(productId, nextIds);
    } catch (e: any) {
      setSelectedNames(prevNames);
      alert(`❌ فشل تحديث الأقسام: ${e?.message || e}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleChange(nextNames: string[]) {
    const filtered = nextNames.filter((nm) => taxonIdByName.has(nm));
    await commit(filtered);
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

  // عنصر شارة واحدة (للاستخدام في الوضعين)
  const Chip = ({ name }: { name: string }) => (
    <span
      className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-zinc-200/70 bg-zinc-50/80 px-3 py-1.5 text-[12px] text-zinc-700 shadow-sm"
      title={name}
    >
      {name}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!syncing) handleRemove(name);
        }}
        className="rounded-full p-1 text-zinc-500 transition hover:bg-zinc-100/80 disabled:opacity-50"
        title="إزالة"
        aria-label={`إزالة ${name}`}
        disabled={syncing}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );

  return (
    <div className={className}>
      <MultiTagSelect
        selected={selectedNames}
        onChange={handleChange}
        suggestions={suggestions}
        placeholder={placeholder}
      />

      {/* شريط معلومات + زر توسيع/إخفاء */}
      <div className="mt-1 flex items-center justify-between">
        <div className="text-[11px] text-zinc-500">
          {selectedNames.length > 0 ? `${selectedNames.length} تصنيف` : "لا توجد أقسام مرتبطة"}
        </div>
        {selectedNames.length > 0 && (
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
      {selectedNames.length > 0 && (
        expanded ? (
          // ✅ وضع موسّع: التفاف متعدد الأسطر (بدون تمرير)
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedNames.map((name) => <Chip key={name} name={name} />)}
          </div>
        ) : (
          // ✅ وضع مضغوط: سطر واحد بتمرير أفقي
          <div className="mt-2 relative">
            <div
              className="flex gap-2 overflow-x-auto no-scrollbar"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {selectedNames.map((name) => <Chip key={name} name={name} />)}
            </div>
            <style>{`
              .no-scrollbar::-webkit-scrollbar { display: none; }
              .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
          </div>
        )
      )}

      {syncing && (
        <div className="mt-1 text-[11px] text-zinc-500">جارٍ تحديث الأقسام…</div>
      )}
    </div>
  );
}
