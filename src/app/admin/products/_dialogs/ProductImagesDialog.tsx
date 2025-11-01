// src/app/admin/products/_dialogs/ProductImagesDialog.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import { Trash2, Star, Upload } from "lucide-react";
import { Product } from "../ProductsClient";

type Img = {
  id: string;
  url: string;
  alt: string | null;
  is_primary: boolean;
  sort_order: number;
  type: string;
};

export default function ProductImagesDialog({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved: (patch: Partial<Product>) => void;
}) {
  const [loading, setLoading] = React.useState(true);
  const [list, setList] = React.useState<Img[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [files, setFiles] = React.useState<FileList | null>(null);

  // fetch images on open
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/products/${product.id}/images`, { cache: "no-store" });
        const j = await res.json();
        if (alive) setList((j?.data ?? []) as Img[]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [product.id]);

  async function doUpload() {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      // (اختياري) أوصاف alt بنفس ترتيب الملفات:
      // alts.forEach((a) => fd.append("alts", a));

      const res = await fetch(`/api/admin/products/${product.id}/images`, {
        method: "POST",
        body: fd,
      });
      const j = await res.json();
      if (!res.ok || !j?.success) throw new Error(j?.error || "upload failed");

      const next = [...list, ...j.data].sort((a, b) => a.sort_order - b.sort_order);
      setList(next);
      setFiles(null);

      // لو صارت أول صورة جديدة أساسية تلقائيًا حدّث بطاقة المنتج
      const primary = next.find((x) => x.is_primary);
      if (primary?.url) onSaved({ imageUrl: primary.url });
    } catch (e: any) {
      alert(`فشل رفع الصور: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  async function setPrimary(imgId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/products/${product.id}/images`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryId: imgId }),
      });
      const j = await res.json();
      if (!res.ok || !j?.success) throw new Error(j?.error || "failed to set primary");

      setList((prev) => prev.map((x) => ({ ...x, is_primary: x.id === imgId })));
      const primaryUrl = list.find((x) => x.id === imgId)?.url;
      if (primaryUrl) onSaved({ imageUrl: primaryUrl });
    } catch (e: any) {
      alert(`فشل التعيين: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  async function removeImage(img: Img) {
    if (!confirm("حذف هذه الصورة؟")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/products/${product.id}/images`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: img.id, url: img.url }),
      });
      const j = await res.json();
      if (!res.ok || !j?.success) throw new Error(j?.error || "failed to delete");
      setList((prev) => prev.filter((x) => x.id !== img.id));

      // إن حذفنا الأساسية، عيّن أول صورة متبقية كأساسية محليًا (اختياري)
      if (img.is_primary) {
        const first = list.find((x) => x.id !== img.id);
        if (first) setPrimary(first.id);
        else onSaved({ imageUrl: undefined });
      }
    } catch (e: any) {
      alert(`فشل الحذف: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  // ترتيب بسيط لأعلى/أسفل
  async function move(idx: number, dir: -1 | 1) {
    const next = [...list];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setList(next.map((x, i) => ({ ...x, sort_order: i })));

    try {
      const res = await fetch(`/api/admin/products/${product.id}/images`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.map((x) => x.id) }),
      });
      const jr = await res.json();
      if (!res.ok || !jr?.success) throw new Error(jr?.error || "reorder failed");
    } catch (e: any) {
      alert(`فشل الترتيب: ${e?.message || e}`);
    }
  }

  return (
    <div className="fixed inset-0 z-[999] grid place-items-center bg-black/50 backdrop-blur-md p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-white/20 bg-white/80 shadow-[0_20px_60px_-10px_rgba(0,0,0,.35)] ring-1 ring-black/5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/30 bg-gradient-to-l from-teal-600/10 via-sky-500/10 to-fuchsia-500/10 px-5 py-4">
          <h3 className="m-0 text-base font-extrabold">
            <span className="bg-gradient-to-l from-teal-600 via-sky-600 to-fuchsia-600 bg-clip-text text-transparent">إدارة الصور</span>{" "}
            <span className="text-zinc-800">— {product.name}</span>
          </h3>
          <button onClick={onClose} className="rounded-xl border border-zinc-200/60 bg-white/80 px-3 py-1.5 text-sm">إغلاق</button>
        </div>

        {/* Body */}
        <div className="space-y-5 p-5">
          {/* رفع متعدد */}
          <div className="rounded-2xl border border-zinc-200/70 bg-white/80 p-4 shadow-sm">
            <label className="mb-1 block text-xs text-zinc-600">رفع صور (متعدد)</label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => setFiles(e.currentTarget.files)}
                className="w-full rounded-xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm"
              />
              <button
                onClick={doUpload}
                disabled={busy || !files || !files.length}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                رفع
              </button>
            </div>
          </div>

          {/* قائمة الصور */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {loading ? (
              <div className="col-span-full grid place-items-center py-10 text-sm text-zinc-500">تحميل الصور…</div>
            ) : list.length === 0 ? (
              <div className="col-span-full grid place-items-center py-10 text-sm text-zinc-500">لا توجد صور بعد.</div>
            ) : (
              list
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((img, idx) => (
                  <div key={img.id} className="rounded-2xl border border-zinc-200/70 bg-white/80 p-3 space-y-2">
                    <div className="relative h-40 w-full overflow-hidden rounded-xl border border-zinc-200/60 bg-white">
                      <Image src={img.url} alt={img.alt ?? ""} fill unoptimized className="object-contain" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          title="تعيين كصورة أساسية"
                          onClick={() => setPrimary(img.id)}
                          className={`rounded-lg border px-2 py-1 text-xs ${img.is_primary ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white"}`}
                        >
                          <Star className="mr-1 inline h-3.5 w-3.5" />
                          أساسية
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => move(idx, -1)} className="rounded-lg border px-2 py-1 text-xs">↑</button>
                        <button onClick={() => move(idx, +1)} className="rounded-lg border px-2 py-1 text-xs">↓</button>
                        <button
                          onClick={() => removeImage(img)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200/70 bg-white/90 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50/80"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          حذف
                        </button>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end">
            <button onClick={onClose} className="rounded-xl border border-zinc-200/70 bg-white/80 px-4 py-2 text-sm">
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
