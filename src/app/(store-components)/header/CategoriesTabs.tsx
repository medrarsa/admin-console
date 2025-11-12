// src/app/(store-components)/header/StickyCategoriesTabs.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, Search, User2 } from "lucide-react";
import { fetchCategoriesTree } from "@/lib/store/categories";

type Root = { id: string; name: string; slug: string };

/* عنصر Skeleton واحد بطول مخصص */
function Skel({ w = 64 }: { w?: number }) {
  return (
    <span
      className="h-3 animate-pulse rounded bg-zinc-200/70"
      style={{ width: w }}
    />
  );
}

export default function StickyCategoriesTabs() {
  // null = جاري التحميل (يُظهر الـSkeleton)
  const [roots, setRoots] = React.useState<Root[] | null>(null);
  const pathname = usePathname();

  // جلب الجذور من القاعدة
  React.useEffect(() => {
    let alive = true;
    fetchCategoriesTree()
      .then((tree) => {
        if (!alive) return;
        const list = tree.map((r: any) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
        }));
        setRoots(list);
      })
      .catch(() => setRoots([])); // حتى لو فشل نعرض بار فاضي بدون اهتزاز
    return () => {
      alive = false;
    };
  }, []);

  const activeSlug = pathname?.startsWith("/categories/")
    ? pathname.split("/")[2]
    : null;

  // ✅ الشريط ثابت دائمًا، يحجز المساحة من أول لحظة ولا يختفي عند التحديث
  return (
    <div
      className="sticky top-0 z-40 bg-white border-b border-zinc-200/70 shadow-[0_1px_0_0_rgba(0,0,0,0.03)]"
      style={{ minHeight: 44 }} // يحفظ المساحة دائمًا
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-11 items-center justify-between">
          {/* أيقونات كبسولات على الطرف */}
          <div className="flex items-center gap-2">
            <Link
              href="/cart"
              className="grid h-9 w-9 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50 active:scale-[.98]"
              title="السلة"
              aria-label="السلة"
            >
              <ShoppingBag size={18} />
            </Link>
            <Link
              href="/search"
              className="grid h-9 w-9 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50 active:scale-[.98]"
              title="بحث"
              aria-label="بحث"
            >
              <Search size={18} />
            </Link>
            <Link
              href="/account"
              className="grid h-9 w-9 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50 active:scale-[.98]"
              title="حسابي"
              aria-label="حسابي"
            >
              <User2 size={18} />
            </Link>
          </div>

          {/* تبويبات الأقسام أو Skeleton أثناء التحميل */}
          <nav className="flex items-center justify-center gap-10 overflow-x-auto text-sm">
            {roots === null ? (
              // Skeleton: يظهر فورًا عند التحديث ويحافظ على مكان البار
              <div className="flex items-center gap-6">
                <Skel w={52} />
                <Skel w={68} />
                <Skel w={56} />
                <Skel w={74} />
                <Skel w={60} />
              </div>
            ) : (
              (roots ?? []).map((c) => {
                const isActive = activeSlug === c.slug;
                return (
                  <Link
                    key={c.id}
                    href={`/categories/${encodeURIComponent(c.slug)}`}
                    title={c.slug}
                    className={
                      "group relative whitespace-nowrap pb-2 transition-colors " +
                      (isActive
                        ? "text-[#F27A1A] font-semibold"
                        : "text-zinc-600 hover:text-zinc-800")
                    }
                  >
                    {c.name}
                    {isActive && (
                      <span className="absolute inset-x-0 -bottom-[2px] mx-auto h-[2px] w-10 rounded-full bg-gradient-to-r from-[#F27A1A] to-[#ffb36a] transition-[width] duration-200 group-hover:w-12" />
                    )}
                  </Link>
                );
              })
            )}
          </nav>

          {/* موازنة الطرفين */}
          <div className="w-[96px]" aria-hidden />
        </div>
      </div>
    </div>
  );
}
