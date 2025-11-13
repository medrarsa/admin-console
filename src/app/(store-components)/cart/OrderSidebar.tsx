"use client";

import * as React from "react";

const sar = (n: number) => `${Number(n || 0).toFixed(2)} ر.س`;

type Totals = {
  subtotal: number;
  discount: number;
  shipping: number;
  grand: number;
};

export default function OrderSidebar({ totals }: { totals: Totals }) {
  const freeShipTarget = 139;
  const progress = Math.max(
    0,
    Math.min(1, (totals.subtotal || 0) / freeShipTarget)
  );

  const [coupon, setCoupon] = React.useState("");
  const [applied, setApplied] = React.useState<null | {
    code: string;
    amount: number;
    free_shipping?: boolean;
  }>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  /* عند التحميل/التحديث:
     - لو فيه خصم من السيرفر و كوكي coupon_code موجودة → اعتبر الكوبون مطبَّقًا وأظهر زر الإزالة.
     - لا نعمل apply تلقائي لتجنّب الحلقات. */
  React.useEffect(() => {
    const m = (typeof document !== "undefined" ? document.cookie : "").match(
      /(?:^|;\s*)coupon_code=([^;]+)/
    );
    const saved = m ? decodeURIComponent(m[1]) : "";

    if (saved && (totals?.discount || 0) > 0) {
      setApplied({
        code: saved,
        amount: totals.discount,
        free_shipping: false,
      });
      if (typeof window !== "undefined") {
        sessionStorage.setItem("coupon_auto_applied", "1");
      }
    }
  }, [totals.discount]);

  /* تطبيق الكوبون يدويًا */
  const apply = async () => {
    const code = coupon.trim();
    if (!code) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/store/marketing/apply-coupon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message || j?.error || "failed");

      setApplied({
        code: j.data.code,
        amount: j.data.discount,
        free_shipping: !!j.data.free_shipping,
      });
      if (typeof window !== "undefined") {
        sessionStorage.setItem("coupon_auto_applied", "1");
      }
      // حدّث السلة من السيرفر
      window.dispatchEvent(new CustomEvent("coupons:changed"));

      if (j.data?.stored === false) {
        setErr(
          "تمّ تطبيق الكوبون مؤقتًا، لكن حفظه في السلة فشل (تحقق من RLS)."
        );
      }
    } catch (e: any) {
      setErr(e?.message || "تعذر تطبيق الكوبون");
    } finally {
      setBusy(false);
    }
  };

  /* إزالة الكوبون */
  const remove = async () => {
    setBusy(true);
    setErr(null);
    try {
      await fetch("/api/store/marketing/remove-coupon", { method: "POST" });
      setApplied(null);
      setCoupon("");
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("coupon_auto_applied");
      }
      window.dispatchEvent(new CustomEvent("coupons:changed"));
    } catch (e: any) {
      setErr(e?.message || "تعذر إزالة الكوبون");
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="space-y-4" dir="rtl">
      {/* صندوق الشحن */}
      <div className="rounded-2xl border p-4">
        <div className="mb-1 text-lg font-semibold">شحن محلي</div>
        <div className="text-sm text-zinc-600">
          احصل على شحن مجاني عند إضافة {sar(freeShipTarget)} للسلة
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-zinc-200">
          <div
            className="h-2 rounded-full bg-zinc-400"
            style={{ width: `${progress * 100}%` }}
          />
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

      {/* ملخص + كوبون */}
      <div className="rounded-2xl border p-4">
        <div className="mb-3 text-lg font-semibold">ملخّص الطلب</div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">مجموع المنتجات (بدون ضريبة)</span>
          <span className="tabular-nums">{sar(totals.subtotal || 0)}</span>
        </div>

        {!applied ? (
          <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
            <button
              type="button"
              className="rounded-lg border px-3 text-sm"
              disabled={busy}
              onClick={apply}
            >
              إضافة
            </button>
            <input
              className="rounded-lg border px-3 py-2 text-sm"
              placeholder="هل لديك كود خصم"
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              disabled={busy}
            />
            <button
              type="button"
              className="rounded-lg border px-3 text-sm"
              onClick={() => setCoupon("")}
              disabled={busy}
              title="مسح"
            >
              ×
            </button>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <span>
              خصم كوبون <strong>{applied.code}</strong>
            </span>
            <div className="flex items-center gap-3">
              <span className="tabular-nums">−{sar(applied.amount || 0)}</span>
              <button
                type="button"
                onClick={remove}
                className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs"
                disabled={busy}
              >
                إزالة
              </button>
            </div>
          </div>
        )}

        {err && <div className="mt-2 text-xs text-rose-600">{err}</div>}

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
