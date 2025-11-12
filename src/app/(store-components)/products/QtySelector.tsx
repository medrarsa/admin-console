// src/app/(store-components)/products/QtySelector.tsx
"use client";
import * as React from "react";

export default function QtySelector({
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  value?: number;
  onChange?: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const [q, setQ] = React.useState<number>(value ?? min);
  React.useEffect(() => setQ(value ?? min), [value, min]);

  const set = (n: number) => {
    const v = Math.min(max, Math.max(min, n));
    setQ(v);
    onChange?.(v);
  };

  return (
    <div className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white">
      <button
        type="button"
        className="h-10 w-10 text-lg"
        onClick={() => set(q - 1)}
        aria-label="decrease"
      >
        −
      </button>
      <div className="w-10 text-center tabular-nums">{q}</div>
      <button
        type="button"
        className="h-10 w-10 text-lg"
        onClick={() => set(q + 1)}
        aria-label="increase"
      >
        +
      </button>
    </div>
  );
}
