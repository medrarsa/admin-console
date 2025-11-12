// src/app/(store-components)/products/OptionValuesList.tsx
"use client";
import * as React from "react";

type Value = { id: string; label: string };
type Group = { id: string; name: string; kind: "choice" | "addon"; values: Value[] };

export default function OptionValuesList({ groups }: { groups: Group[] }) {
  if (!groups?.length) return null;

  // نطلق حدث عام يسمعه OptionsPicker
  const pick = (valueId: string) => {
    window.dispatchEvent(new CustomEvent("pick-option-value", { detail: { valueId } }));
  };

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.id} className="space-y-2">
          <div className="text-sm font-medium">{g.name}</div>
          <div className="flex flex-wrap gap-2">
            {(g.values || []).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => pick(v.id)}
                className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
                title={v.label}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
