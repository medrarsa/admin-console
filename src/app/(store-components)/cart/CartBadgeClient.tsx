"use client";
import * as React from "react";

export default function CartBadgeClient() {
  const [count, setCount] = React.useState(0);

  async function refresh() {
    const r = await fetch("/api/store/cart", { cache: "no-store" });
    const j = await r.json();
    const items = j?.data?.items ?? [];
    const c = items.reduce((n: number, it: any) => n + (it.qty || 0), 0);
    setCount(c);
  }

  React.useEffect(() => {
    refresh();
    const onUpd = () => refresh();
    window.addEventListener("cart-updated", onUpd as any);
    return () => window.removeEventListener("cart-updated", onUpd as any);
  }, []);

  return (
    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-black text-white text-xs px-2">
      {count}
    </span>
  );
}
