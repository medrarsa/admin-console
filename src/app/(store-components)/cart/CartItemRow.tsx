"use client";

import * as React from "react";
import Image from "next/image";

export type CartItem = {
  id: string;
  product_id: string;
  variant_id?: string | null;
  qty: number;
  unit_list: number;
  unit_sale?: number | null;
  label_kind?: string | null; // "sale" | "single" | "range" أو نص
  label_text?: string | null; // مثال: "خصم 25%" أو "السعر"
  snapshot?: any;             // نتوقع فيه { name, image|images[], options[] }
};

const sar = (n: number) =>
  `${n.toFixed(2)} ر.س`;

export default function CartItemRow({
  item,
  onQtyChange,
  onRemove,
}: {
  item: CartItem;
  onQtyChange: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}) {
  const price = item.unit_sale ?? item.unit_list;
  const total = price * item.qty;

  const img =
    item?.snapshot?.image ||
    item?.snapshot?.images?.[0] ||
    "/placeholder.png";

  const name =
    item?.snapshot?.name ||
    item?.label_text ||
    "منتج";

  const options: Array<{ name?: string; value?: string }> =
    item?.snapshot?.options || [];

  const dec = () => onQtyChange(item.id, Math.max(1, item.qty - 1));
  const inc = () => onQtyChange(item.id, Math.min(99, item.qty + 1));
  const disabledMinus = item.qty <= 1;
  const disabledPlus = item.qty >= 99;

  // لون البادج حسب النوع
  const badge =
    item.label_kind === "sale"
      ? "bg-rose-50 text-rose-700 ring-rose-100"
      : item.label_kind === "range"
      ? "bg-amber-50 text-amber-700 ring-amber-100"
      : "bg-sky-50 text-sky-700 ring-sky-100";

  return (
    <div className="flex items-start gap-4 rounded-2xl border p-3 md:p-4">
      {/* صورة */}
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-1 ring-zinc-100">
        <Image
          src={img}
          alt={name}
          fill
          sizes="80px"
          className="object-cover"
          unoptimized
        />
      </div>

      {/* معلومات */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-medium truncate">{name}</div>
          {item.label_text && (
            <span className={`ms-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ${badge}`}>
              {item.label_text}
            </span>
          )}
        </div>

        {/* خيارات (إن وجدت) */}
        {options.length > 0 && (
          <div className="mt-1 text-sm text-zinc-500 truncate">
            {options.map((op, i) => (
              <span key={i} className="inline-block">
                {i ? " • " : ""}
                {op.name ? `${op.name}: ` : ""}
                {op.value ?? ""}
              </span>
            ))}
          </div>
        )}

        {/* تحكم الكمية + حذف */}
        <div className="mt-2 flex items-center gap-3">
          <div className="inline-flex items-center rounded-full border px-1">
            <button
              type="button"
              onClick={dec}
              disabled={disabledMinus}
              className="h-8 w-8 text-lg leading-none disabled:opacity-40"
              aria-label="decrease"
            >
              −
            </button>
            <span className="w-8 text-center tabular-nums">{item.qty}</span>
            <button
              type="button"
              onClick={inc}
              disabled={disabledPlus}
              className="h-8 w-8 text-lg leading-none disabled:opacity-40"
              aria-label="increase"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="text-sm text-red-600 hover:underline"
          >
            حذف
          </button>
        </div>
      </div>

      {/* أسعار */}
      <div className="text-left md:text-right">
        <div className="text-sm text-zinc-500">السعر للوحدة</div>
        <div className="tabular-nums">{sar(price)}</div>

        {/* لو في تخفيض، اعرض السعر الأساسي مشطوب */}
        {item.unit_sale != null && item.unit_sale < item.unit_list && (
          <div className="mt-0.5 text-xs text-zinc-400 line-through tabular-nums">
            {sar(item.unit_list)}
          </div>
        )}

        <div className="mt-2 text-sm text-zinc-500">الإجمالي</div>
        <div className="font-medium tabular-nums">{sar(total)}</div>
      </div>
    </div>
  );
}
