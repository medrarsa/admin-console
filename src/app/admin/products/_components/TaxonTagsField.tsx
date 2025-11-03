"use client";

import * as React from "react";
import MultiTagSelect from "./MultiTagSelect";

type FlatTaxon = {
  id: string;
  name: string;
  parent_id: string | null;
  level: "root" | "sub" | "seg";
  slug?: string;
  sort_order?: number;
};

async function fetchFlatTaxons(): Promise<FlatTaxon[]> {
  const r = await fetch("/api/admin/taxons?flat=true", { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.success) throw new Error(j?.error || `GET ${r.status}`);
  return (j.data ?? []) as FlatTaxon[];
}

async function fetchProductTaxonIds(productId: string): Promise<string[]> {
  // نستخدم راوت المنتج الحالي — لو ما يرجّع product_taxons ما مشكلة،
  // إحنا أصلاً نخزّن ids محليًا بعد أول جلب ونحدثها مع كل PATCH.
  const r = await fetch(`/api/admin/products/${productId}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.success) throw new Error(j?.error || `GET ${r.status}`);
  // لو راوتك ما يرجع product_taxons، رجّع مصفوفة فاضية ونخلي المستخدم يختار من جديد
  const ids = Array.isArray(j?.data?.product_taxons)
    ? j.data.product_taxons.map((x: any) => x.taxon_id)
    : [];
  return ids;
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

/**
 * - يظهر زر "أضف تصنيف"
 * - يعرض البادجات للأقسام المختارة
 * - يزامن مباشرة مع الـAPI عند أي تغيير
 */
export default function TaxonTagsField({
  productId,
  className,
  placeholder = "أضف تصنيف",
  initialTaxonIds, // اختياري
}: {
  productId: string;
  className?: string;
  placeholder?: string;
  initialTaxonIds?: string[];
}) {
  const [loading, setLoading] = React.useState(true);
  const [allTaxons, setAllTaxons] = React.useState<FlatTaxon[]>([]);
  const [selectedNames, setSelectedNames] = React.useState<string[]>([]);
  const [taxonIdByName, setTaxonIdByName] = React.useState<Map<string, string>>(new Map());
  const [nameByTaxonId, setNameByTaxonId] = React.useState<Map<string, string>>(new Map());

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);

        const flat = await fetchFlatTaxons();
        if (!alive) return;
        setAllTaxons(flat);

        const idByName = new Map<string, string>();
        const nameById = new Map<string, string>();
        flat.forEach(t => {
          idByName.set(t.name, t.id);
          nameById.set(t.id, t.name);
        });
        setTaxonIdByName(idByName);
        setNameByTaxonId(nameById);

        const productTaxonIds = Array.isArray(initialTaxonIds)
          ? initialTaxonIds
          : await fetchProductTaxonIds(productId);

        const names = productTaxonIds
          .map(id => nameById.get(id))
          .filter(Boolean) as string[];
        setSelectedNames(names);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [productId]);

  const suggestions = React.useMemo(() => allTaxons.map(t => t.name), [allTaxons]);

  async function handleChange(nextNames: string[]) {
    // امنع إنشاء أسماء جديدة — فقط من الموجود في القاعدة
    const nextIds: string[] = [];
    for (const nm of nextNames) {
      const id = taxonIdByName.get(nm);
      if (id) nextIds.push(id);
    }

    const prevNames = selectedNames;
    setSelectedNames(nextNames); // تحديث واجهة مباشر

    try {
      await patchProductTaxons(productId, nextIds);
      // نجاح: خلي البادجات زي ما هي
    } catch (e: any) {
      setSelectedNames(prevNames); // رجّع الواجهة
      alert(`❌ فشل تحديث الأقسام: ${e?.message || e}`);
    }
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

  return (
    <div className={className}>
      <MultiTagSelect
        selected={selectedNames}
        onChange={handleChange}
        suggestions={suggestions}
        placeholder={placeholder}
      />

      {/* البادجات المختارة — واضحة داخل البطاقة */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {selectedNames.length === 0 ? (
          <span className="text-xs text-zinc-500">لا توجد أقسام مرتبطة.</span>
        ) : (
          selectedNames.map((name) => (
            <span
              key={name}
              className="inline-flex items-center rounded-full border border-zinc-200/70 bg-zinc-50/80 px-2.5 py-1 text-[12px] text-zinc-700"
              title={name}
            >
              {name}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
