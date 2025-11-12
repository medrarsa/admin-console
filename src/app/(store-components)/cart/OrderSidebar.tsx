"use client";

import * as React from "react";
const sar = (n: number) => `${n.toFixed(2)} ر.س`;

export default function OrderSidebar({
  totals,
}: {
  totals: { subtotal: number; discount: number; grand: number };
}) {
  const freeShipTarget = 139;
  const progress = Math.max(0, Math.min(1, (totals.subtotal || 0) / freeShipTarget));
  const [coupon, setCoupon] = React.useState("");

  return (
    <aside className="space-y-4" dir="rtl">
      {/* شحن محلي */}
      <div className="rounded-2xl border p-4">
        <div className="mb-1 text-lg font-semibold">شحن محلي</div>
        <div className="text-sm text-zinc-600">احصل على شحن مجاني عند إضافة {sar(freeShipTarget)} للسلة</div>
        <div className="mt-3 h-2 w-full rounded-full bg-zinc-200">
          <div className="h-2 rounded-full bg-zinc-400" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      {/* هدية */}
      <div className="rounded-2xl border p-4">
        <div className="mb-2 text-lg font-semibold">أرسل الطلب كهدية</div>
        <div className="text-sm text-zinc-600">
          الآن يمكنك إرسال الهدايا إلى أحبائك عبر منصتنا في أي وقت.
        </div>
        <button
          type="button"
          className="mt-3 w-full rounded-xl border px-4 py-2 text-sm"
          onClick={() => alert("قريبًا ✅")}
        >
          أرسلها كهدية
        </button>
      </div>

      {/* ملخص الطلب */}
      <div className="rounded-2xl border p-4">
        <div className="mb-3 text-lg font-semibold">ملخّص الطلب</div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">مجموع المنتجات (بدون ضريبة)</span>
          <span className="tabular-nums">{sar(totals.subtotal || 0)}</span>
        </div>

        <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <button type="button" className="rounded-lg border px-3 text-sm">إضافة</button>
          <input
            className="rounded-lg border px-3 py-2 text-sm"
            placeholder="هل لديك كود خصم"
            value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg border px-3 text-sm"
            onClick={() => setCoupon("")}
            title="مسح"
          >
            ×
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-zinc-500">ضريبة القيمة المضافة</span>
          <span className="tabular-nums">
            {sar(Math.max(0, (totals.grand || 0) - (totals.subtotal || 0) + (totals.discount || 0)))}
          </span>
        </div>

        <div className="my-3 border-t" />

        <div className="flex items-center justify-between text-base font-semibold">
          <span>الإجمالي</span>
          <span className="tabular-nums">{sar(totals.grand || 0)}</span>
        </div>

        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-white hover:bg-emerald-700"
          onClick={() => alert("إتمام الطلب قريبًا ✅")}
        >
          إتمام الطلب
        </button>
      </div>
    </aside>
  );
}
