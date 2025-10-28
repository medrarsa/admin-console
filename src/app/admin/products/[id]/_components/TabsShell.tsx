// src/app/admin/products/[id]/_components/TabsShell.tsx
"use client";

import { Suspense, useState } from "react";
import VariantsTab from "./VariantsTab"; // نفس المجلد

export default function TabsShell({ productId }: { productId: string }) {
  const [tab, setTab] = useState<"info" | "variants" | "images">("variants");

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b">
        {(["info", "variants", "images"] as const).map((t) => (
          <button
            key={t}
            className={`px-3 py-2 -mb-px border-b-2 ${
              tab === t
                ? "border-black font-semibold"
                : "border-transparent text-gray-500"
            }`}
            onClick={() => setTab(t)}
          >
            {t === "info"
              ? "بيانات المنتج"
              : t === "variants"
              ? "الخيارات والكمية"
              : "الصور"}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div className="rounded-xl border p-4">
          <div className="text-sm text-gray-500">
            قريبًا: نموذج بيانات المنتج…
          </div>
        </div>
      )}

      {tab === "variants" && (
        <Suspense
          fallback={<div className="rounded-xl border p-4">تحميل…</div>}
        >
          <VariantsTab productId={productId} />
        </Suspense>
      )}

      {tab === "images" && (
        <div className="rounded-xl border p-4">
          <div className="text-sm text-gray-500">قريبًا: إدارة صور المنتج…</div>
        </div>
      )}
    </div>
  );
}
