// src/app/page.tsx
"use client";

import React from "react";

/* UI — بدون StoreHeader/StoreFooter */
import CategoriesNav from "@/app/(store-components)/categories/CategoriesNav";
import CategoriesSidebar from "@/app/(store-components)/categories/CategoriesSidebar";
import FiltersPanel from "@/app/(store-components)/filters/FiltersPanel";
import ProductGrid from "@/app/(store-components)/products/ProductGrid";

export default function Page() {
  const [filters, setFilters] = React.useState<{
    q?: string;
    brand?: string;
    root?: string;
    sub?: string;
    seg?: string;
  }>({});

  React.useEffect(() => {
    const qp = new URLSearchParams(window.location.search);
    const root = qp.get("root") || undefined;
    const sub = qp.get("sub") || undefined;
    const seg = qp.get("seg") || undefined;
    setFilters((f) => ({ ...f, root, sub, seg }));
  }, []);

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* شريط الأقسام (الجذور) */}
      <CategoriesNav
        onPick={(rootSlug) => {
          setFilters((prev) => {
            const nextRoot = rootSlug || undefined;
            if (prev.root === nextRoot && !prev.sub && !prev.seg) return prev;
            return { ...prev, root: nextRoot, sub: undefined, seg: undefined };
          });
        }}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <div className="space-y-6">
          <CategoriesSidebar
            value={{ root: filters.root, sub: filters.sub, seg: filters.seg }}
            onChange={(v) => setFilters((f) => ({ ...f, ...v }))}
          />
          <FiltersPanel value={filters} onChange={setFilters} />
        </div>

        <ProductGrid filters={filters} />
      </div>
    </section>
  );
}
