// src/app/(store-components)/products/VariantTables.tsx
"use client";
import * as React from "react";

/* نعرض أسماء القيم كراديو (بديل الجداول) */
type Value = { id: string; label: string };
type Group = {
  id: string;
  name: string;
  kind: "choice" | "addon";
  values: Value[];
};
type Variant = {
  id: string;
  value_ids: string[];
  price?: number | null;
  sale_price?: number | null;
};

type Props = { groups: Group[]; variants: Variant[] };

function hasVariantFor(candidateIds: string[], variants: Variant[]) {
  return variants.some((v) =>
    candidateIds.every((id) => v.value_ids.includes(id))
  );
}

export default function VariantTables({ groups, variants }: Props) {
  const choiceGroups = (groups || []).filter((g) => g.kind === "choice");

  // اختيار محلي للمعاينة والحالة البصرية
  const [sel, setSel] = React.useState<Record<string, string | undefined>>(
    () => {
      const init: Record<string, string | undefined> = {};
      if (choiceGroups[0]?.values?.[0]?.id)
        init[choiceGroups[0].id] = choiceGroups[0].values[0].id;
      return init;
    }
  );

  const isAvailable = (groupId: string, valueId: string) => {
    const nextSel = { ...sel, [groupId]: valueId };
    const ids = choiceGroups
      .map((g) => nextSel[g.id])
      .filter(Boolean) as string[];
    return ids.length === 0 ? true : hasVariantFor(ids, variants);
  };

  const choose = (groupId: string, valueId: string) => {
    if (!isAvailable(groupId, valueId)) return;
    setSel((s) => ({ ...s, [groupId]: valueId }));
    // إخطار OptionsPicker لتحديث الاختيار والسعر
    window.dispatchEvent(
      new CustomEvent("pick-option-value", { detail: { valueId } })
    );
  };

  return (
    <div className="space-y-5">
      {choiceGroups.map((g) => (
        <fieldset key={g.id} className="space-y-2">
          <legend className="text-sm font-medium">{g.name}</legend>
          <div className="flex flex-wrap gap-2">
            {(g.values || []).map((v) => {
              const active = sel[g.id] === v.id;
              const available = isAvailable(g.id, v.id);
              return (
                <label
                  key={v.id}
                  className={[
                    "inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm",
                    active
                      ? "bg-black text-white border-black"
                      : "bg-white text-zinc-800 border-zinc-300 hover:bg-zinc-50",
                    !available && "opacity-40 cursor-not-allowed",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <input
                    type="radio"
                    name={`opt-${g.id}`}
                    className="sr-only"
                    checked={active}
                    disabled={!available}
                    onChange={() => choose(g.id, v.id)}
                  />
                  {v.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
