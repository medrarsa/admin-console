"use client";

import React from "react";
import Link from "next/link";
import { fetchCategoriesTree } from "@/lib/store/categories";

type Root = {
  id: string;
  name: string;
  slug: string;
  subs: {
    id: string;
    name: string;
    slug: string;
    segs: { id: string; name: string; slug: string }[];
  }[];
};

export default function CategoriesMegaNav() {
  const [tree, setTree] = React.useState<Root[]>([]);
  const [openId, setOpenId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    fetchCategoriesTree()
      .then((d) => mounted && setTree(d))
      .catch(() => setTree([]));
    return () => {
      mounted = false;
    };
  }, []);

  const closeLater = React.useRef<NodeJS.Timeout | null>(null);
  const scheduleClose = () => {
    closeLater.current = setTimeout(() => setOpenId(null), 120);
  };
  const cancelClose = () => {
    if (closeLater.current) clearTimeout(closeLater.current);
  };

  return (
    <nav className="hidden md:flex items-center gap-4">
      {tree.map((root) => {
        const hasSubs = root.subs && root.subs.length > 0;

        return (
          <div
            key={root.id}
            className="relative"
            onMouseEnter={() => {
              if (hasSubs) {
                cancelClose();
                setOpenId(root.id);
              }
            }}
            onMouseLeave={() => {
              if (hasSubs) scheduleClose();
            }}
          >
            {/* الضغط ينقلك دائماً لصفحة التصنيف */}
            <Link
              href={`/categories/${encodeURIComponent(root.slug)}`}
              className={`px-3 h-9 inline-flex items-center rounded-full border transition
                ${
                  openId === root.id
                    ? "bg-black text-white border-black"
                    : "bg-white hover:bg-neutral-50"
                }`}
              aria-expanded={hasSubs && openId === root.id ? true : false}
            >
              {root.name}
            </Link>

            {/* منسدلة الفروع — تظهر فقط لو فيه فروع (Hover فقط) */}
            {hasSubs && openId === root.id && (
              <div
                className="absolute top-full right-0 mt-2 w-[340px] bg-white border rounded-2xl shadow-xl p-2 z-50"
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
              >
                <ul className="max-h-[60vh] overflow-auto divide-y">
                  {root.subs.map((sub) => (
                    <li key={sub.id} className="py-2">
                      <div className="px-3 flex items-center justify-between">
                        <Link
                          href={`/categories/${encodeURIComponent(
                            root.slug
                          )}?sub=${encodeURIComponent(sub.slug)}`}
                          className="font-medium hover:underline"
                          title={sub.slug}
                        >
                          {sub.name}
                        </Link>
                        <Link
                          href={`/categories/${encodeURIComponent(
                            root.slug
                          )}?sub=${encodeURIComponent(sub.slug)}`}
                          className="text-xs text-neutral-500 hover:text-black"
                          title={`عرض كل ${sub.name}`}
                        >
                          الكل →
                        </Link>
                      </div>

                      {sub.segs?.length > 0 && (
                        <div className="mt-2 grid grid-cols-1 gap-1 px-3">
                          {sub.segs.slice(0, 8).map((g) => (
                            <Link
                              key={g.id}
                              href={`/categories/${encodeURIComponent(
                                root.slug
                              )}?sub=${encodeURIComponent(sub.slug)}`}
                              className="text-sm text-neutral-700 hover:underline truncate"
                              title={g.slug}
                            >
                              {g.name}
                            </Link>
                          ))}
                          {sub.segs.length > 8 && (
                            <span className="text-xs text-neutral-500 px-1">
                              … والمزيد
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* طبقة حماية صغيرة تمنع تداخل hover مع عناصر مجاورة */}
            <span className="absolute inset-0 pointer-events-none" />
          </div>
        );
      })}
    </nav>
  );
}
