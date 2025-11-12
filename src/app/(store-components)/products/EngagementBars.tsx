// src/app/(store-components)/products/EngagementBars.tsx
"use client";
import * as React from "react";

export function ViewersNow({ count = 7 }: { count?: number }) {
  if (count <= 0) return null;
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white">
        ﻉ
      </span>
      <span>يشاهد المنتج الآن: {count}</span>
    </div>
  );
}

export function StockLeft({ left = 5 }: { left?: number }) {
  if (left <= 0) return null;
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white">
        !
      </span>
      <span>باقي {left} قطع — اطلب بسرعة!</span>
    </div>
  );
}

export function FreeShippingBar({
  needed = 150,
  current = 0,
  currency = "ر.س",
}: {
  needed?: number;
  current?: number;
  currency?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round((current / needed) * 100)));
  return (
    <div className="space-y-2">
      <div className="text-xs text-zinc-600">
        تبقّى{" "}
        <b>
          {Math.max(0, needed - current)} {currency}
        </b>{" "}
        للشحن المجاني
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full bg-indigo-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
