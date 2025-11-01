// src/app/admin/products/_components/SallaProductCard.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import {
  ImagePlus,
  Pin,
  Settings,
  Bell,
  MoreVertical,
  ChevronDown,
  X,
} from "lucide-react";
import MultiTagSelect from "./MultiTagSelect";
import type { Product } from "../ProductsClient";

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Props = {
  p: Product;
  onChange: (patch: Partial<Product>) => void;
  onDelete: () => void;             // سيُستدعى بعد نجاح الحذف لتحديث القائمة في الأب
  onOpenEdit: () => void;
  onOpenOptions: () => void;
  onOpenImages: () => void;
  onSaveCard: () => Promise<void>;
};

export default function SallaProductCard({
  p,
  onChange,
  onDelete,
  onOpenEdit,
  onOpenOptions,
  onOpenImages,
  onSaveCard,
}: Props) {
  const [checked, setChecked] = React.useState(false);
  const [name, setName] = React.useState(p.name);
  const [price, setPrice] = React.useState<number | undefined>(p.price);
  const [qty, setQty] = React.useState<number | undefined>(p.qty);
  const [tags, setTags] = React.useState<string[]>(p.tags ?? []);
  const [localCat, setLocalCat] = React.useState<string | null>(p.localCategory ?? null);
  const [saving, setSaving] = React.useState(false);

  // حوار تأكيد الحذف
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // ادفع التغييرات للأب (بدون تغيير المنطق)
  React.useEffect(() => {
    onChange({ name, price, qty, tags, localCategory: localCat });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, price, qty, tags, localCat]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSaveCard();
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    try {
      setDeleting(true);
      const res = await fetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        alert(`فشل الحذف: ${json?.error || res.statusText}`);
        return;
      }
      setConfirmOpen(false);
      onDelete(); // أخبر الأب ليشيل البطاقة من القائمة
    } finally {
      setDeleting(false);
    }
  }

  function removeTag(label: string) {
    setTags((t) => t.filter((x) => x !== label));
  }

  return (
    <div className="relative rounded-2xl border border-white/20 bg-white/80 p-2 shadow-[0_10px_40px_-10px_rgba(0,0,0,.25)] ring-1 ring-black/5 backdrop-blur supports-[backdrop-filter]:bg-white/60 transition hover:shadow-[0_16px_60px_-12px_rgba(0,0,0,.35)]">
      {/* checkbox */}
      <label className="absolute end-2 top-2 inline-flex cursor-pointer items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => setChecked(e.currentTarget.checked)}
        />
        <span className="grid size-5 place-items-center rounded-md border border-zinc-200/70 bg-white/80 text-zinc-500 shadow-sm transition peer-checked:border-teal-300 peer-checked:text-teal-700">
          <span className="size-2 rounded-[3px] bg-transparent peer-checked:bg-teal-600" />
        </span>
      </label>

      {/* image */}
      <div className="relative mb-2 overflow-hidden rounded-2xl border border-zinc-200/60 bg-white/70 shadow-sm">
        <div className="relative aspect-square">
          {p.imageUrl ? (
            <Image
              src={p.imageUrl}
              alt={p.name || "صورة المنتج"}
              fill
              sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw"
              unoptimized
              priority={false}
              className="object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-400">
              <div className="rounded-xl border border-dashed border-zinc-300 bg-white/80 px-3 py-1.5 text-xs">
                لا صورة
              </div>
            </div>
          )}
        </div>

        {/* pin */}
        <button
          type="button"
          title={p.pinned ? "إلغاء التثبيت" : "تثبيت"}
          onClick={() => onChange({ pinned: !p.pinned })}
          className="absolute start-2 top-2 grid size-9 place-items-center rounded-full border border-zinc-200/70 bg-white/90 text-zinc-600 shadow-sm transition hover:bg-white"
        >
          <Pin className={cx("h-4 w-4", p.pinned && "fill-zinc-700")} />
        </button>

        {/* add image/video */}
        <button
          type="button"
          onClick={onOpenImages}
          className="absolute inset-x-0 bottom-0 m-2 flex items-center justify-center gap-2 rounded-xl bg-white/85 px-3 py-1.5 text-[13px] text-teal-700 ring-1 ring-teal-200 shadow-sm transition hover:bg-white"
        >
          <ImagePlus className="h-4 w-4" />
          إضافة صورة أو فيديو
        </button>
      </div>

      {/* name */}
      <div className="mb-2">
        <input
          className="w-full rounded-2xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/40 transition"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="اسم المنتج"
        />
      </div>

      {/* price + bell */}
      <div className="mb-2 flex items-center gap-2">
        <div className="relative w-full">
          <span className="pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 rounded-md border border-zinc-200/70 bg-zinc-50/80 px-2 py-0.5 text-[12px] text-zinc-600">
            رس
          </span>
          <input
            type="text"
            inputMode="decimal"
            className="w-full rounded-2xl border border-zinc-200/70 bg-white/80 px-10 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/40 transition"
            placeholder="0.00"
            value={typeof price === "number" ? String(price) : ""}
            onChange={(e) => {
              const v = e.currentTarget.value.trim();
              setPrice(v === "" ? undefined : Number(v));
            }}
          />
        </div>
        <button
          type="button"
          title="تنبيهات"
          className="grid size-9 place-items-center rounded-xl border border-zinc-200/70 bg-white/80 text-zinc-600 shadow-sm transition hover:bg-zinc-50/80"
        >
          <Bell className="h-4 w-4" />
        </button>
      </div>

      {/* options + qty */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onOpenOptions}
          title="الخيارات والكمية"
          className="col-span-2 inline-flex items-center justify-between rounded-2xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-[13px] text-zinc-700 shadow-sm transition hover:bg-zinc-50/80"
        >
          <span className="inline-flex items-center gap-2">
            <Settings className="h-4 w-4" />
            الخيارات والكمية
          </span>
          <ChevronDown className="h-4 w-4" />
        </button>

        <div className="relative">
          <span className="pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 text-[12px] text-zinc-500">
            0
          </span>
          <input
            type="text"
            inputMode="numeric"
            className="w-full rounded-2xl border border-zinc-200/70 bg-white/80 px-8 py-2 text-center text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/40 transition"
            placeholder="0"
            value={typeof qty === "number" ? String(qty) : ""}
            onChange={(e) => {
              const raw = e.currentTarget.value.trim();
              const num = raw === "" ? undefined : Number(raw);
              const safe = Number.isFinite(num as number)
                ? (num as number)
                : undefined;
              setQty(safe);
              onChange({ qty: safe });
            }}
          />
        </div>
      </div>

      {/* tags + local category */}
      <div className="mb-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/70 bg-zinc-50/80 px-2.5 py-1 text-[12px] text-zinc-700 shadow-sm"
            >
              {t}
              <button
                type="button"
                className="rounded-full p-1 text-zinc-500 transition hover:bg-zinc-100/80"
                onClick={() => removeTag(t)}
                title="إزالة"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>

        <MultiTagSelect
          selected={tags}
          onChange={(next) => {
            setTags(next);
            onChange({ tags: next });
          }}
        />

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-[13px] text-zinc-600 shadow-sm">
            تصنيف محلي
          </div>
          <select
            className="rounded-2xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-[13px] text-zinc-700 outline-none shadow-sm focus:ring-2 focus:ring-teal-500/40 transition"
            value={localCat ?? ""}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setLocalCat(v || null);
            }}
          >
            <option value="">اختر تصنيف محلي</option>
            <option value="suspension">تعليق/مساعدات</option>
            <option value="body">بودي خارجي</option>
            <option value="lights">أنوار</option>
          </select>
        </div>
      </div>

      {/* open product-data modal */}
      <details className="group mb-3 overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/80 shadow-sm">
        <summary
          className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[13px] text-zinc-700 transition hover:bg-zinc-50/80"
          onClick={(e) => {
            e.preventDefault();
            onOpenEdit();
          }}
        >
          <span>بيانات المنتج</span>
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </summary>
      </details>

      {/* footer buttons */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="inline-flex items-center gap-2 rounded-2xl border border-rose-200/70 bg-white/80 px-3 py-2 text-[13px] text-rose-700 shadow-sm transition hover:bg-rose-50/80"
        >
          حذف
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="grid size-9 place-items-center rounded-2xl border border-zinc-200/70 bg-white/80 text-zinc-600 shadow-sm transition hover:bg-zinc-50/80"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={cx(
              "rounded-2xl px-6 py-2 text-sm font-semibold text-white shadow transition",
              saving
                ? "bg-gradient-to-l from-teal-400 to-sky-400 cursor-wait"
                : "bg-gradient-to-l from-teal-600 to-sky-600 hover:brightness-[1.05] active:brightness-95"
            )}
          >
            {saving ? "جارٍ الحفظ…" : "حفظ"}
          </button>
        </div>
      </div>

      {/* Confirm Delete Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40">
          <div className="w-[90%] max-w-md rounded-2xl bg-white p-5 shadow-xl" dir="rtl">
            <h3 className="mb-2 text-lg font-bold">تأكيد الحذف</h3>
            <p className="text-sm text-zinc-600">
              هل أنت متأكد من حذف المنتج:{" "}
              <span className="font-semibold text-rose-600">{p.name}</span>؟ هذا الإجراء لا يمكن التراجع عنه.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
                className="rounded-xl border px-4 py-2"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white"
              >
                {deleting ? "جارِ الحذف..." : "نعم، احذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
