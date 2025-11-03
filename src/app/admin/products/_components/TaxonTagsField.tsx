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
  // الراوت يُرجع الآن taxons: [{id,name}]
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

/**
 * حقل أقسام المنتج:
 * - زر "أضف تصنيف" (قائمة بكل التصنيفات الموجودة)
 * - بادجات قابلة للإزالة (X) — الحذف يحفظ فورًا
 * - عند تحديث الصفحة/فتح البطاقة: يعيد ملء المختار تلقائيًا
 */
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
  const [allTaxons, setAllTaxons] = React.useState<FlatTaxon[]>([]);
  const [selectedNames, setSelectedNames] = React.useState<string[]>([]);
  const [taxonIdByName, setTaxonIdByName] = React.useState<Map<string, string>>(new Map());
  const [nameByTaxonId, setNameByTaxonId] = React.useState<Map<string, string>>(new Map());

  // نجلب التصنيفات + أقسام المنتج
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

        // اضبط المختار بالأسماء (عشان MultiTagSelect يقدر يعرضها)
        const names = prodTaxons
          .map((t) => t.name)
          .filter(Boolean);
        setSelectedNames(names);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [productId]);

  const suggestions = React.useMemo(() => allTaxons.map((t) => t.name), [allTaxons]);

  // يحوّل الأسماء إلى IDs — يمنع إضافة اسم غير موجود في قاعدة البيانات
  function namesToIds(names: string[]) {
    const ids: string[] = [];
    for (const nm of names) {
      const id = taxonIdByName.get(nm);
      if (id) ids.push(id);
    }
    return ids;
  }

  // إضافة/تغيير من MultiTagSelect
  async function handleChange(nextNames: string[]) {
    const nextIds = namesToIds(nextNames);
    const prevNames = selectedNames;
    setSelectedNames(nextNames);

    try {
      await patchProductTaxons(productId, nextIds);
      // تمت المزامنة بنجاح
    } catch (e: any) {
      setSelectedNames(prevNames); // رجّع الواجهة
      alert(`❌ فشل تحديث الأقسام: ${e?.message || e}`);
    }
  }

  // إزالة عنصر من البادجات
  async function handleRemove(name: string) {
    const nextNames = selectedNames.filter((n) => n !== name);
    await handleChange(nextNames);
  }

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-sm text-zinc-600">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-top-zinc-600" />
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

      {/* البادجات + زر الحذف */}
      <div className="mt-2 flex flex-wrap gap-6">
        {selectedNames.length === 0 ? (
          <span className="text-xs text-zinc-500">لا توجد أقسام مرتبطة.</span>
        ) : (
          selectedNames.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200/70 bg-zinc-50/80 px-3 py-1.5 text-[12px] text-zinc-700 shadow-sm"
              title={name}
            >
              {name}
              <button
                type="button"
                onClick={() => handleRemove(name)}
                className="rounded-full p-1 text-zinc-500 transition hover:bg-zinc-100/80"
                title="إزالة"
                aria-label={`إزالة ${name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
