"use client";

import * as React from "react";
import Image from "next/image";

type Item = {
  id: string;
  product_id: string;
  variant_id?: string | null;
  qty: number;
  unit_list: number;
  unit_sale?: number | null;
  label_kind?: string | null;
  label_text?: string | null;
  snapshot?: any;
};

const sar = (n: number) => `${n.toFixed(2)} ر.س`;

export default function CartItemCard({
  item,
  onQtyChange,
  onRemove,
}: {
  item: Item;
  onQtyChange: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}) {
  const price = item.unit_sale ?? item.unit_list;
  const total = price * item.qty;

  const img = item?.snapshot?.image || item?.snapshot?.images?.[0] || "/placeholder.png";
  const name = item?.snapshot?.name || "منتج";
  const options: Array<{ name?: string; value?: string }> = item?.snapshot?.options || [];

  const dec = () => onQtyChange(item.id, Math.max(1, item.qty - 1));
  const inc = () => onQtyChange(item.id, Math.min(99, item.qty + 1));

  return (
    <div className="rounded-2xl border p-4 md:p-5" dir="rtl">
      <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-start">
        {/* يمين: صورة المنتج */}
        <div className="order-1 md:order-1">
          <div className="relative h-20 w-20 overflow-hidden rounded-xl ring-1 ring-zinc-100">
            <Image src={img} alt={name} fill sizes="80px" className="object-cover" unoptimized />
          </div>
        </div>

        {/* وسط: الاسم + السعر + الخيارات + مرفقات */}
        <div className="order-3 md:order-2 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-medium truncate">{name}</div>
            {item.label_text && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 ring-1 ring-emerald-100">
                {item.label_text}
              </span>
            )}
          </div>

          <div className="mt-1 text-sm">
            <span className="tabular-nums">{sar(price)}</span>
            {item.unit_sale != null && item.unit_sale < item.unit_list && (
              <span className="me-2 text-xs text-zinc-400 line-through tabular-nums">
                {sar(item.unit_list)}
              </span>
            )}
            <span className="ms-3 text-zinc-500">المجموع: </span>
            <span className="font-semibold tabular-nums">{sar(total)}</span>
          </div>

          {/* خيارات */}
          <div className="mt-3 space-y-2">
            {options.length ? (
              options.map((op, i) => (
                <select
                  key={i}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-200"
                  defaultValue={op.value || ""}
                  disabled
                >
                  <option value="">{op.name || "خيار"}</option>
                  {op.value ? <option value={op.value}>{op.value}</option> : null}
                </select>
              ))
            ) : (
              <div className="text-sm text-zinc-500">لا توجد خيارات لهذا المنتج</div>
            )}
          </div>

          {/* مرفقات (واجهة) */}
          <div className="mt-3">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm text-zinc-600"
              disabled
            >
              📎 إرفاق ملف
            </button>
          </div>
        </div>

        {/* يسار: التحكم بالكمية + حذف */}
        <div className="order-2 md:order-3 flex items-start gap-2">
          <div className="inline-flex items-center rounded-full border px-1">
            <button type="button" onClick={inc} className="h-8 w-8 text-lg leading-none">+</button>
            <span className="w-10 text-center tabular-nums">{item.qty}</span>
            <button type="button" onClick={dec} className="h-8 w-8 text-lg leading-none">−</button>
          </div>

          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-600"
            title="حذف"
            aria-label="remove"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
