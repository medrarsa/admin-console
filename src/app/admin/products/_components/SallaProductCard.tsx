// src/app/admin/products/_components/SallaProductCard.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import {
  ImagePlus,
  Pin,
  Settings,
  ChevronDown,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import TaxonTagsField from "./TaxonTagsField";
import type { Product } from "../ProductsClient"; // تأكد أن النوع من نفس المصدر عندك

const toNum = (x: unknown) => {
  if (x == null) return null;
  const s = typeof x === "string" ? x.trim() : x;
  const n = typeof s === "string" ? Number(s) : s;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

type Props = {
  p: Product;
  onChange: (patch: Partial<Product>) => void;
  onDelete: () => void;
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
  const [name, setName] = React.useState(p.name);
  const [saving, setSaving] = React.useState(false);
  const [saveDone, setSaveDone] = React.useState(false);
  const [saveErr, setSaveErr] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [toggling, setToggling] = React.useState(false);

  // قيم قادمة من الـ API للبطاقة (نطاق أسعار عبر الخيارات + كميات)
  const vMin = toNum((p as any).variants_price_min);
  const vMax = toNum((p as any).variants_price_max);
  const vQty = toNum((p as any).variants_total_qty);
  const priceLabel = (p as any).variants_price_label as
    | string
    | null
    | undefined;
  const baseP = toNum((p as any).base_price_fallback);
  const baseQ = toNum((p as any).base_qty_fallback);

  const rangeHasNumbers =
    vMin !== null && vMin > 0 && vMax !== null && vMax >= vMin;
  const rangeFromOptions =
    !!rangeHasNumbers &&
    ((vMin as number) !== (vMax as number) ||
      (typeof baseP === "number" ? (vMin as number) !== baseP : false));
  const hasOptionQty = vQty !== null && vQty > 0;

  // السعر الأساسي المعروض فقط (بدون salePrice)
  const apiDisplayPrice = rangeFromOptions
    ? (vMin as number)
    : typeof baseP === "number"
    ? baseP
    : null;
  const apiDisplayQty =
    hasOptionQty && vQty !== null
      ? vQty
      : typeof baseQ === "number"
      ? baseQ
      : null;

  const [priceInput, setPriceInput] = React.useState<string>(
    apiDisplayPrice != null ? String(apiDisplayPrice) : ""
  );
  const [qtyInput, setQtyInput] = React.useState<string>(
    apiDisplayQty != null ? String(apiDisplayQty) : ""
  );

  React.useEffect(() => {
    const id = setTimeout(() => onChange({ name }), 120);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  React.useEffect(() => {
    if (!rangeFromOptions && apiDisplayPrice != null && priceInput === "")
      setPriceInput(String(apiDisplayPrice));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiDisplayPrice, rangeFromOptions]);

  React.useEffect(() => {
    if (!hasOptionQty && apiDisplayQty != null && qtyInput === "")
      setQtyInput(String(apiDisplayQty));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiDisplayQty, hasOptionQty]);

  const lockPrice = rangeFromOptions;
  const lockQty = hasOptionQty;

  const commitPriceIfNeeded = React.useCallback(() => {
    if (lockPrice) return;
    const n = toNum(priceInput);
    onChange({ price: n == null ? undefined : (n as any) });
  }, [lockPrice, priceInput, onChange]);

  const commitQtyIfNeeded = React.useCallback(() => {
    if (lockQty) return;
    const n = toNum(qtyInput);
    onChange({ qty: n == null ? undefined : (n as any) });
  }, [lockQty, qtyInput, onChange]);

  async function handleSave() {
    if (saving) return;
    setSaveErr(null);
    setSaving(true);
    setSaveDone(false);
    try {
      commitPriceIfNeeded();
      commitQtyIfNeeded();
      await onSaveCard();
      setSaveDone(true);
      setTimeout(() => setSaveDone(false), 900);
    } catch (e: any) {
      setSaveErr(e?.message || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    try {
      setDeleting(true);
      const res = await fetch(`/api/admin/products/${p.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setSaveErr(json?.error || "فشل الحذف");
        return;
      }
      setConfirmOpen(false);
      onDelete();
    } finally {
      setDeleting(false);
    }
  }

  const disableInputs = saving || deleting;

  // ===== حالة العرض/التعطيل =====
  const isDisabled = (p as any).status === "hidden";

  async function toggleActive() {
    if (disableInputs || toggling) return;
    try {
      setToggling(true);
      const res = await fetch(`/api/admin/products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toggleActive: true }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setSaveErr(json?.error || "تعذّر تبديل الحالة");
        return;
      }
      // حاول أخذ الحالة المحدثة من الاستجابة
      const nextStatus =
        json?.data?.status ??
        json?.data?.after?.status ??
        (json?.data && json.data.status);
      if (nextStatus) onChange({ status: nextStatus } as any);
    } catch (e: any) {
      setSaveErr(e?.message || "تعذّر تبديل الحالة");
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="relative rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm transition hover:shadow-md">
      {/* الصورة */}
      <div className="relative mb-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="relative aspect-square">
          {(p as any).imageUrl ? (
            <Image
              src={(p as any).imageUrl}
              alt={p.name || "صورة المنتج"}
              fill
              sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw"
              loading="lazy"
              unoptimized
              className="object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-400">
              <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-3 py-1.5 text-xs">
                لا صورة
              </div>
            </div>
          )}
        </div>

        {/* زر العين: تعطيل/تشغيل */}
        <button
          type="button"
          onClick={toggleActive}
          disabled={disableInputs || toggling}
          title={isDisabled ? "تشغيل المنتج" : "تعطيل المنتج"}
          className={
            "absolute start-2 top-2 grid size-9 place-items-center rounded-full border shadow-sm transition " +
            (isDisabled
              ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
              : "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100")
          }
        >
          {toggling ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : isDisabled ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>

        {/* لاصق حالة صغير تحت الأيقونة */}
        <div
          className={
            "absolute start-2 top-12 select-none rounded-full px-2 py-0.5 text-[11px] shadow-sm " +
            (isDisabled
              ? "bg-rose-50 text-rose-700 border border-rose-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200")
          }
        >
          {isDisabled ? "معطّل" : "شغّال"}
        </div>

        {/* دبوس التثبيت — اليمين */}
        <button
          type="button"
          title={(p as any).pinned ? "إلغاء التثبيت" : "تثبيت"}
          onClick={() => onChange({ pinned: !(p as any).pinned } as any)}
          disabled={disableInputs}
          className="absolute end-2 top-2 grid size-9 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50"
        >
          <Pin
            className={"h-4 w-4" + ((p as any).pinned ? " fill-zinc-700" : "")}
          />
        </button>

        {/* إضافة صورة/فيديو */}
        <button
          type="button"
          onClick={onOpenImages}
          disabled={disableInputs}
          className="absolute inset-x-0 bottom-0 m-2 flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-1.5 text-[13px] text-teal-700 ring-1 ring-teal-200 shadow-sm transition hover:bg-white/90 disabled:opacity-50"
        >
          <ImagePlus className="h-4 w-4" />
          إضافة صورة أو فيديو
        </button>
      </div>

      {/* الاسم */}
      <div className="mb-2">
        <input
          className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/40 transition disabled:opacity-50"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="اسم المنتج"
          disabled={disableInputs}
        />
      </div>

      {/* السعر — أساسي فقط */}
      <div className="mb-2">
        <div className="flex w-full items-stretch gap-2">
          <span className="grid min-w-[64px] place-items-center rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-[12px] text-zinc-700">
            رس
          </span>
          <div className="relative flex-1">
            <input
              dir="rtl"
              type="text"
              inputMode="decimal"
              className={
                "w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-end text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/40 transition " +
                (rangeFromOptions
                  ? "cursor-not-allowed bg-zinc-50 text-zinc-500"
                  : "") +
                (disableInputs ? " opacity-50" : "")
              }
              placeholder="أدخل السعر"
              value={
                rangeFromOptions ? String(apiDisplayPrice ?? "") : priceInput
              }
              onChange={(e) => {
                if (rangeFromOptions) return;
                const raw = e.currentTarget.value.replace(/[^\d.]/g, "");
                setPriceInput(raw);
              }}
              onBlur={commitPriceIfNeeded}
              readOnly={rangeFromOptions}
              disabled={rangeFromOptions || disableInputs}
            />
          </div>
        </div>
        {rangeFromOptions && !!priceLabel && (
          <div className="mt-1 text-[12px] text-zinc-600">{priceLabel}</div>
        )}
      </div>

      {/* الخيارات + غير محدود + الكمية */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onOpenOptions}
          disabled={disableInputs}
          className="col-span-1 inline-flex h-10 w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white px-3 text-[13px] text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50"
          title="الخيارات والكمية"
        >
          <span className="inline-flex items-center gap-2">
            <Settings className="h-4 w-4" />
            الخيارات
          </span>
          <ChevronDown className="h-4 w-4" />
        </button>

        <button
          type="button"
          disabled={disableInputs}
          className="col-span-1 inline-flex h-10 w-full items-center justify-center rounded-2xl border border-zinc-200 bg-white px-3 text-[13px] text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50"
          title="غير محدود"
        >
          ∞
        </button>

        <input
          type="text"
          inputMode="numeric"
          className={
            "col-span-1 h-10 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-center text-sm outline-none placeholder:text-zinc-400 focus:ring-2 transition " +
            (hasOptionQty
              ? "cursor-not-allowed bg-zinc-50 text-zinc-500"
              : "") +
            (disableInputs ? " opacity-50" : "")
          }
          placeholder="0"
          value={hasOptionQty ? String(apiDisplayQty ?? "") : qtyInput}
          onChange={(e) => {
            if (hasOptionQty) return;
            const raw = e.currentTarget.value.replace(/[^\d]/g, "");
            setQtyInput(raw);
          }}
          onBlur={commitQtyIfNeeded}
          readOnly={hasOptionQty}
          disabled={hasOptionQty || disableInputs}
        />
      </div>

      {/* التصنيف */}
      <div className="mb-3">
        <TaxonTagsField productId={p.id} placeholder="أضف تصنيف" />
      </div>

      {/* شريط سفلي: حذف أحمر + بيانات المنتج */}
      <div className="mb-2 grid grid-cols-2 gap-2">
        {/* حذف */}
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={disableInputs}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-3 text-[13px] font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50"
          title="حذف"
        >
          <Trash2 className="h-4 w-4" />
          حذف
        </button>

        <button
          type="button"
          disabled={disableInputs}
          onClick={() => {
            if (!disableInputs) onOpenEdit();
          }}
          className="inline-flex h-10 items-center justify-between rounded-2xl border border-zinc-200 bg-white px-3 text-[13px] text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50"
          title="بيانات المنتج"
        >
          <span>بيانات المنتج</span>
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* زر الحفظ ممتد */}
      <button
        type="button"
        onClick={handleSave}
        disabled={disableInputs}
        aria-busy={saving ? "true" : "false"}
        className="mb-1 inline-flex h-10 w-full items-center justify-center rounded-2xl bg-teal-100 text-teal-800 shadow-sm transition hover:bg-teal-200 disabled:opacity-70"
        title="حفظ التعديلات"
      >
        {saving ? "جارٍ الحفظ…" : saveDone ? "تم الحفظ ✓" : "حفظ"}
      </button>

      {saveErr && (
        <div className="mt-2 text-[12px] text-rose-600">{saveErr}</div>
      )}

      {/* تأكيد الحذف */}
      {confirmOpen && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-white/70 backdrop-blur-sm">
          <div className="w-[92%] max-w-sm rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl">
            <h4 className="mb-2 text-base font-bold text-zinc-800">
              تأكيد الحذف
            </h4>
            <p className="mb-4 text-sm text-zinc-600">
              هل أنت متأكد من حذف المنتج{" "}
              <span className="font-semibold">“{p.name}”</span>؟ لا يمكن التراجع
              عن هذه العملية.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmOpen(false)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={doDelete}
                disabled={deleting}
                className="rounded-xl border border-rose-300 bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? "جارٍ الحذف…" : "نعم، احذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
