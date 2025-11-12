"use client";
import * as React from "react";

type Props = {
  promotionId: string; // نحتاج promotion_id
  checked: boolean; // true = active / false = inactive
};

export default function CouponStatusSwitch({ promotionId, checked }: Props) {
  const [on, setOn] = React.useState(checked);
  const [busy, setBusy] = React.useState(false);

  const toggle = async () => {
    if (busy) return;
    const next = !on;
    setOn(next); // تفاؤلي
    setBusy(true);
    try {
      // نحول الحالة
      const status = next ? "active" : "inactive";
      const res = await fetch(
        `/api/admin/marketing_tools/promotions/${promotionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      if (!res.ok) {
        setOn(!next); // تراجع
        const txt = await res.text().catch(() => "");
        console.error("toggle error:", res.status, txt);
        alert("تعذّر تغيير الحالة");
      } else {
        // نبثّ حدث للتحديث
        window.dispatchEvent(new CustomEvent("coupons:changed"));
      }
    } catch (e) {
      setOn(!next);
      console.error(e);
      alert("تعذّر الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label={on ? "تعطيل الكوبون" : "تفعيل الكوبون"}
      className={`h-6 w-11 rounded-full relative transition 
                 ${on ? "bg-emerald-500" : "bg-zinc-300"} ${
        busy ? "opacity-60" : ""
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform
                    ${on ? "translate-x-5" : "translate-x-0.5"}`}
      />
    </button>
  );
}
