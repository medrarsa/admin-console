// src/app/(store-components)/categories/CategoriesSidebar.tsx
"use client";
import * as React from "react";
import { fetchCategoriesTree, type RootNode } from "@/lib/store/categories";

type Value = { root?: string; sub?: string; seg?: string };

export default function CategoriesSidebar({
  value,
  onChange,
}: {
  value?: Value;
  onChange?: (v: Value) => void;
}) {
  const [tree, setTree] = React.useState<RootNode[]>([]);
  React.useEffect(() => {
    fetchCategoriesTree()
      .then(setTree)
      .catch(() => setTree([]));
  }, []);
  const currentRoot = tree.find((r) => r.slug === value?.root);
  const currentSub = currentRoot?.subs.find((s) => s.slug === value?.sub);

  return (
    <aside className="space-y-4">
      <div className="p-4 rounded-2xl border">
        <label className="block text-sm mb-1">القسم الرئيسي</label>
        <select
          className="w-full h-10 px-3 rounded-lg border"
          value={value?.root ?? ""}
          onChange={(e) =>
            onChange?.({
              root: e.target.value || undefined,
              sub: undefined,
              seg: undefined,
            })
          }
        >
          <option value="">الكل</option>
          {tree.map((r) => (
            <option key={r.id} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <div className="p-4 rounded-2xl border">
        <label className="block text-sm mb-1">فرع القسم</label>
        <select
          className="w-full h-10 px-3 rounded-lg border"
          disabled={!currentRoot}
          value={value?.sub ?? ""}
          onChange={(e) =>
            onChange?.({
              ...value,
              sub: e.target.value || undefined,
              seg: undefined,
            })
          }
        >
          <option value="">الكل</option>
          {currentRoot?.subs.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="p-4 rounded-2xl border">
        <label className="block text-sm mb-1">التقسيم</label>
        <select
          className="w-full h-10 px-3 rounded-lg border"
          disabled={!currentSub}
          value={value?.seg ?? ""}
          onChange={(e) =>
            onChange?.({ ...value, seg: e.target.value || undefined })
          }
        >
          <option value="">الكل</option>
          {currentSub?.segs.map((g) => (
            <option key={g.id} value={g.slug}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
    </aside>
  );
}
