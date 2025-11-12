// src/app/(store-components)/products/AddToCartBar.tsx
"use client";
import * as React from "react";
import QtySelector from "./QtySelector";

export default function AddToCartBar({
  onAdd,
  busyText = "جارٍ الإضافة...",
  okText = "أضف إلى السلة",
}: {
  onAdd: (qty: number) => Promise<void> | void;
  busyText?: string;
  okText?: string;
}) {
  const [qty, setQty] = React.useState(1);
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (busy) return;
    try {
      setBusy(true);
      await onAdd(qty);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <QtySelector value={qty} onChange={setQty} />
      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="flex h-10 flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
      >
        {busy ? busyText : okText}
      </button>

      {/* رموز: هدية + مفضلة */}
      <button
        type="button"
        title="هدية"
        className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-200 bg-white"
      >
        🎁
      </button>
      <button
        type="button"
        title="مفضلة"
        className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-200 bg-white"
      >
        ❤
      </button>
    </div>
  );
}
