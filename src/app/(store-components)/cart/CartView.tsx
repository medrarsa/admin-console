"use client";
import * as React from "react";
import CartItemCard from "./CartItemCard";
import OrderSidebar from "./OrderSidebar";

type CartItem = {
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
type Totals = {
  subtotal: number;
  discount: number;
  shipping: number;
  grand: number;
};
type CartData = { cart_id: string | null; items: CartItem[]; totals: Totals };

export default function CartView() {
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<CartData | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const loadingRef = React.useRef(false);

  const load = React.useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/store/cart", { cache: "no-store" });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.error || "failed");
      setData(j.data as CartData);
    } catch (e: any) {
      setErr(e?.message || "تعذر جلب السلة");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    const onUpdated = () => load();
    window.addEventListener("cart-updated", onUpdated as EventListener);
    window.addEventListener("coupons:changed", onUpdated as EventListener);
    return () => {
      window.removeEventListener("cart-updated", onUpdated as EventListener);
      window.removeEventListener("coupons:changed", onUpdated as EventListener);
    };
  }, [load]);

  const onQtyChange = async (cartItemId: string, qty: number) => {
    try {
      const r = await fetch("/api/store/cart/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cartItemId, qty }),
      });
      const j = await r.json();
      if (j?.success) window.dispatchEvent(new CustomEvent("cart-updated"));
    } catch {}
  };

  const onRemove = async (cartItemId: string) => {
    try {
      const r = await fetch("/api/store/cart/remove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cartItemId }),
      });
      const j = await r.json();
      if (j?.success) window.dispatchEvent(new CustomEvent("cart-updated"));
    } catch {}
  };

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-[320px_1fr]" dir="rtl">
        <div className="space-y-4">
          <div className="h-40 rounded-2xl bg-zinc-100 animate-pulse" />
          <div className="h-56 rounded-2xl bg-zinc-100 animate-pulse" />
        </div>
        <div className="h-80 rounded-2xl bg-zinc-100 animate-pulse" />
      </div>
    );
  }
  if (err)
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
        {err}
      </div>
    );

  const items = data?.items ?? [];
  const totals: Totals = data?.totals ?? {
    subtotal: 0,
    discount: 0,
    shipping: 0,
    grand: 0,
  };

  return (
    <div className="grid gap-6 md:grid-cols-[320px_1fr]" dir="rtl">
      <OrderSidebar totals={totals} />
      <section className="space-y-4">
        {items.length === 0 ? (
          <div className="rounded-2xl border p-6 text-zinc-500">سلتك فارغة</div>
        ) : (
          items.map((it) => (
            <CartItemCard
              key={it.id}
              item={it}
              onQtyChange={onQtyChange}
              onRemove={onRemove}
            />
          ))
        )}
      </section>
    </div>
  );
}
