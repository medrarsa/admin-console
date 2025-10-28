"use client";

import * as React from "react";
import Image from "next/image";
import { Trash2, Star } from "lucide-react";
import { Product } from "../ProductsClient";

async function patchProduct(productId: string, payload: Record<string, any>) {
  const res = await fetch(`/api/admin/products/${productId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json?.success) throw new Error(json?.error || "فشل الحفظ");
  return json.data;
}

export default function ProductImagesDialog({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved: (patch: Partial<Product>) => void;
}) {
  // في النسخة الحالية نستعمل حقل imageUrl واحد من المنتج كصورة أساسية
  const [url, setUrl] = React.useState(product.imageUrl ?? "");

  async function saveNow() {
    // هنا تربط product_images الحقيقي لاحقًا
    onSaved({ imageUrl: url || undefined });
    await patchProduct(product.id, {
      /* مكان ربط الصور الحقيقي لاحقًا */
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[999] grid place-items-center bg-black/50 backdrop-blur-md p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-white/20 bg-white/80 shadow-[0_20px_60px_-10px_rgba(0,0,0,.35)] ring-1 ring-black/5 supports-[backdrop-filter]:bg-white/60">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/30 bg-gradient-to-l from-teal-600/10 via-sky-500/10 to-fuchsia-500/10 px-5 py-4">
          <h3 className="m-0 text-base font-extrabold tracking-tight">
            <span className="bg-gradient-to-l from-teal-600 via-sky-600 to-fuchsia-600 bg-clip-text text-transparent">
              إدارة الصور
            </span>{" "}
            <span className="text-zinc-800">— {product.name}</span>
          </h3>
          <button
            className="rounded-xl border border-zinc-200/60 bg-white/80 px-3 py-1.5 text-sm hover:bg-zinc-50/80 transition-colors"
            onClick={onClose}
          >
            إغلاق
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 p-5">
          {/* رابط الصورة */}
          <div className="rounded-2xl border border-zinc-200/70 bg-white/80 p-4 shadow-sm">
            <label className="mb-1 block text-xs text-zinc-600">
              رابط الصورة الأساسية
            </label>
            <input
              className="w-full rounded-xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/40 transition"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…/image.png"
            />
            {/* معاينة */}
            <div className="mt-3 rounded-2xl border border-zinc-200/70 bg-white/70 p-3 shadow-sm">
              {url ? (
                <div
                  className="relative h-56 w-full overflow-hidden rounded-xl border border-zinc-200/60 bg-[length:16px_16px] bg-[linear-gradient(to_right,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.04)_1px,transparent_1px)]"
                  title="Preview"
                >
                  <Image
                    src={url}
                    alt="preview"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="h-56 w-full grid place-items-center rounded-xl border border-dashed border-zinc-300 text-zinc-400">
                  لا معاينة
                </div>
              )}
            </div>
          </div>

          {/* أزرار الحفظ */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setUrl("")}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200/70 bg-white/80 px-3 py-2 text-[13px] text-rose-700 shadow-sm hover:bg-rose-50/80 transition"
              type="button"
            >
              <Trash2 className="h-4 w-4" />
              إزالة
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="rounded-xl border border-zinc-200/70 bg-white/80 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50/80 transition"
                type="button"
              >
                إلغاء
              </button>
              <button
                onClick={saveNow}
                className="rounded-xl bg-gradient-to-l from-teal-600 to-sky-600 px-6 py-2 text-sm font-semibold text-white shadow hover:brightness-[1.05] active:brightness-95 transition"
              >
                حفظ
              </button>
            </div>
          </div>

          {/* ملاحظة تنبيهية */}
          <div className="rounded-2xl border border-amber-200/70 bg-amber-50/80 p-3 text-[12px] text-amber-900 shadow-sm">
            <Star className="me-2 inline-block h-4 w-4" />
            ملاحظة: ربط الصور النهائي عبر جدول <b>product_images</b> وسير عمل
            التخزين في Supabase سنضيفه لاحقًا.
          </div>
        </div>
      </div>
    </div>
  );
}
