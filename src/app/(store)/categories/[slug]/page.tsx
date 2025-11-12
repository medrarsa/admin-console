// src/app/categories/[slug]/page.tsx
"use client";

import React from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import ProductGrid from "@/app/(store-components)/products/ProductGrid";
import { fetchCategoriesTree, type RootNode } from "@/lib/store/categories";

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearchParams();
  const router = useRouter();

  const [tree, setTree] = React.useState<RootNode[]>([]);
  const [root, setRoot] = React.useState<RootNode | null>(null);
  const [activeSub, setActiveSub] = React.useState<string | undefined>(
    undefined
  );

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const t = await fetchCategoriesTree();
      if (!mounted) return;
      setTree(t);
      const r = t.find((x) => x.slug === slug) || null;
      setRoot(r);

      const subQP = search.get("sub") || undefined;
      if (subQP && r?.subs.some((s) => s.slug === subQP)) {
        setActiveSub(subQP);
      } else {
        setActiveSub(undefined);
      }
    })().catch(() => {
      setTree([]);
      setRoot(null);
      setActiveSub(undefined);
    });
    return () => {
      mounted = false;
    };
  }, [slug, search]);

  const setSubTab = (subSlug?: string) => {
    const qp = new URLSearchParams(search.toString());
    if (subSlug) qp.set("sub", subSlug);
    else qp.delete("sub");
    router.replace(`/categories/${slug}?${qp.toString()}`);
    setActiveSub(subSlug);
  };

  if (!root) {
    return (
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="p-8 rounded-2xl border text-center text-neutral-500">
          القسم غير موجود أو مخفي.
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* بنر علوي — غيّر المحتوى لاحقًا */}
      <div className="rounded-2xl border overflow-hidden">
        <div className="bg-gradient-to-r from-neutral-50 to-white p-6 flex flex-col md:flex-row items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/store/placeholders/product.png"
            alt={root.name}
            className="w-28 h-28 object-contain"
          />
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-extrabold">{root.name}</h1>
            <p className="text-neutral-600 text-sm md:text-base mt-1">
              مستلزمات {root.name} — منتجات مختارة بجودة عالية. (بنر قابل
              للتخصيص لاحقًا)
            </p>
          </div>
        </div>
      </div>

      {/* تبويبات الفروع (إن وُجدت) */}
      {root.subs.length > 0 && (
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => setSubTab(undefined)}
            className={`px-4 h-9 rounded-full border text-sm ${
              !activeSub
                ? "bg-black text-white border-black"
                : "bg-white hover:bg-neutral-50"
            }`}
          >
            الكل
          </button>
          {root.subs.map((s) => (
            <button
              key={s.id}
              onClick={() => setSubTab(s.slug)}
              className={`px-4 h-9 rounded-full border text-sm ${
                activeSub === s.slug
                  ? "bg-black text-white border-black"
                  : "bg-white hover:bg-neutral-50"
              }`}
              title={s.slug}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* شبكة المنتجات — إن كان في sub اخترناه نرسل sub، غير كذا نرسل root */}
      <ProductGrid
        filters={{
          root: !activeSub ? root.slug : undefined,
          sub: activeSub || undefined,
        }}
      />
    </section>
  );
}
