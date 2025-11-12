// src/app/(store-components)/categories/CategoriesNav.tsx
"use client";
import * as React from "react";
import { fetchCategoriesTree, type RootNode } from "@/lib/store/categories";

export default function CategoriesNav({
  onPick,
}: {
  onPick?: (slug?: string) => void;
}) {
  const [roots, setRoots] = React.useState<RootNode[]>([]);
  const [active, setActive] = React.useState<string>("all");

  React.useEffect(() => {
    let mounted = true;
    fetchCategoriesTree()
      .then((d) => mounted && setRoots(d))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    onPick?.(active === "all" ? undefined : active);
  }, [active, onPick]);

  return (
    <div className="overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActive("all")}
          className={`px-4 h-10 rounded-full border text-sm ${
            active === "all"
              ? "bg-black text-white border-black"
              : "bg-white hover:bg-neutral-50"
          }`}
        >
          كل المنتجات
        </button>
        {roots.map((r) => (
          <button
            key={r.id}
            onClick={() => setActive(r.slug)}
            className={`px-4 h-10 rounded-full border text-sm ${
              active === r.slug
                ? "bg-black text-white border-black"
                : "bg-white hover:bg-neutral-50"
            }`}
          >
            {r.name}
          </button>
        ))}
      </div>
    </div>
  );
}
