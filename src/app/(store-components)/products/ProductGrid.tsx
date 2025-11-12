// src/app/(store-components)/products/ProductGrid.tsx
"use client";

import * as React from "react";
import ProductCard from "./ProductCard";
import { fetchProducts, type ProductListItem } from "@/lib/store/products";

type Filters = {
  q?: string;
  brand?: string;
  root?: string;
  sub?: string;
  seg?: string;
};

export default function ProductGrid({ filters }: { filters: Filters }) {
  const [items, setItems] = React.useState<ProductListItem[]>([]);
  const [total, setTotal] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);

    fetchProducts({
      q: filters.q,
      root: filters.root,
      sub: filters.sub,
      seg: filters.seg,
      page: 1,
      size: 24,
      // لو عندك قناة وتبي تمررها: channel: "web",
    })
      .then((r) => {
        if (!mounted) return;
        setItems(Array.isArray(r?.data) ? r.data : []);
        // نعتمد total من السيرفر لو موجود وإلا fallback لطول البيانات
        setTotal(
          typeof r?.total === "number"
            ? r.total
            : Array.isArray(r?.data)
            ? r.data.length
            : 0
        );
      })
      .catch(() => {
        if (!mounted) return;
        setItems([]);
        setTotal(0);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
    // التبعيات كما طلبت، بدون تعقيد
  }, [filters.q, filters.root, filters.sub, filters.seg]);

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-neutral-500">
        جارٍ التحميل…
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 text-sm text-neutral-600">
        إجمالي: <b>{total}</b> منتج
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border p-10 text-center text-neutral-500">
          لا توجد نتائج
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
          {items.map((p) => {
            // ✅ تطبيع الحقول الاختيارية لتتوافق مع نوع بطاقة المنتج
            const cardItem = {
              ...p,
              ends_at: (p as any).ends_at ?? null, // string | null
              starts_from: Boolean((p as any).starts_from), // boolean
              brand_name: (p as any).brand_name ?? null, // string | null
            };
            return <ProductCard key={p.id} p={cardItem as any} />;
          })}
        </div>
      )}
    </div>
  );
}
