// src/app/(store-components)/products/OptionsPicker.tsx
"use client";
import * as React from "react";

/* ========= Types ========= */
type Value = {
  id: string;
  label: string;
  value_code?: string | null;
  extra_price?: number; // يُستخدم مع addon لرفع السعر
  // is_default?: boolean; // مدعوم ضمنيًا لو أردته لاحقًا
};
type Group = {
  id: string;
  name: string;
  kind: "choice" | "addon"; // سنعامل الاثنين كراديو (اختيار وحيد)
  display_type?: string | null;
  values: Value[];
};
type Variant = {
  id: string;
  sku?: string | null;
  status: string;
  value_ids: string[];
  price?: number | null;
  sale_price?: number | null;
  ends_at?: string | null;
};
type ProductData = {
  id: string;
  main_variant_id: string | null;
  base_price_fallback: number | null;
  base_qty_fallback: number;
  variants_min_price: number | null;
  variants_max_price: number | null;
  variants_total_qty: number;
  option_groups: Group[] | null | undefined;
  variants: Variant[] | null | undefined;
};

/* ========= Helpers ========= */
const cx = (...xs: (string | false | undefined)[]) =>
  xs.filter(Boolean).join(" ");
const fmt = (n: number | null | undefined) =>
  n == null ? "—" : `${new Intl.NumberFormat("ar-EG").format(n)} ر.س`;

function pickDisplay(v: Variant) {
  const base = v.price ?? null;
  const sale = v.sale_price ?? null;
  const hasSale = base != null && sale != null && sale < base;
  return {
    base,
    sale: hasSale ? sale : null,
    display: hasSale ? (sale as number) : base,
  };
}
function minDisplayOf(list: Variant[]) {
  let bestDisp: number | null = null,
    bestBase: number | null = null,
    bestSale: number | null = null,
    bestVar: Variant | null = null;
  for (const v of list) {
    const { base, sale, display } = pickDisplay(v);
    if (display == null) continue;
    if (bestDisp == null || display < bestDisp) {
      bestDisp = display;
      bestBase = base;
      bestSale = sale;
      bestVar = v;
    }
  }
  return {
    base: bestBase,
    sale: bestSale,
    display: bestDisp,
    variant: bestVar,
  };
}

/* ========= Component ========= */
export default function OptionsPicker({ product }: { product: ProductData }) {
  const groups: Group[] = Array.isArray(product.option_groups)
    ? product.option_groups
    : [];
  const variants: Variant[] = Array.isArray(product.variants)
    ? product.variants
    : [];

  // نفصل المجموعات لاثنين، لكن سنعرضهما كراديو
  const choiceGroups = React.useMemo(
    () => groups.filter((g) => g.kind === "choice"),
    [groups]
  );
  const addonGroups = React.useMemo(
    () => groups.filter((g) => g.kind === "addon"),
    [groups]
  );

  /* ======= اختيار افتراضي لكل مجموعة (كراديو) ======= */
  const initialSel = React.useMemo(() => {
    const obj: Record<string, string | undefined> = {};
    const all = [...choiceGroups, ...addonGroups];
    for (const g of all) {
      const vals = g.values || [];
      if (!vals.length) continue;
      const def = (vals as any[]).find((v) => v?.is_default);
      obj[g.id] = (def?.id ?? vals[0]!.id) as string | undefined;
    }
    return obj;
  }, [choiceGroups, addonGroups]);

  const [sel, setSel] =
    React.useState<Record<string, string | undefined>>(initialSel);

  // ثبّت وجود اختيار لكل مجموعة إذا تغيّرت البيانات
  React.useEffect(() => {
    setSel((prev) => {
      const next = { ...prev };
      const all = [...choiceGroups, ...addonGroups];
      for (const g of all) {
        if (!next[g.id] && g.values?.length) {
          const def = (g.values as any[]).find((v) => v?.is_default);
          next[g.id] = (def?.id ?? g.values[0]!.id) as string | undefined;
        }
      }
      return next;
    });
  }, [choiceGroups, addonGroups]);

  /* ======= الاستماع لاختيار خارجي (من OptionValuesRadio) — اختياري ======= */
  React.useEffect(() => {
    const handler = (e: any) => {
      const valueId = e?.detail?.valueId as string | undefined;
      if (!valueId) return;
      const g =
        choiceGroups.find((gg) => gg.values.some((v) => v.id === valueId)) ||
        addonGroups.find((gg) => gg.values.some((v) => v.id === valueId));
      if (g) setSel((prev) => ({ ...prev, [g.id]: valueId }));
    };
    window.addEventListener("pick-option-value", handler as EventListener);
    return () =>
      window.removeEventListener("pick-option-value", handler as EventListener);
  }, [choiceGroups, addonGroups]);

  /* ======= منطق التوفّر لمجموعات choice فقط ======= */
  const isChoiceValueEnabled = React.useCallback(
    (groupId: string, valueId: string) => {
      // نبني تركيبة ids مرشحة مع تبديل هذه المجموعة
      const hypothetic = { ...sel, [groupId]: valueId };
      const pickedChoiceIds = choiceGroups
        .map((g) => hypothetic[g.id])
        .filter(Boolean) as string[];
      if (!pickedChoiceIds.length) return true;
      return variants.some((v) =>
        pickedChoiceIds.every((id) => v.value_ids.includes(id))
      );
    },
    [sel, variants, choiceGroups]
  );

  /* ======= حساب السعر ======= */
  const pickedChoiceIds = React.useMemo(
    () => choiceGroups.map((g) => sel[g.id]).filter(Boolean) as string[],
    [sel, choiceGroups]
  );

  // متغيّر يطابق كل القيم المختارة (choice)
  const exactVariant: Variant | null = React.useMemo(() => {
    if (!pickedChoiceIds.length) return null;
    return (
      variants.find((v) =>
        pickedChoiceIds.every((id) => v.value_ids.includes(id))
      ) ?? null
    );
  }, [variants, pickedChoiceIds]);

  // أقرب مرشح إن لم يوجد مطابق كامل
  const fallbackVariant: Variant | null = React.useMemo(() => {
    if (!pickedChoiceIds.length) return null;
    const cands = variants.filter((v) =>
      pickedChoiceIds.some((id) => v.value_ids.includes(id))
    );
    if (!cands.length) return null;
    const { variant } = minDisplayOf(cands);
    return variant ?? null;
  }, [variants, pickedChoiceIds]);

  const effectiveVariant = exactVariant ?? fallbackVariant ?? null;

  // سعر المتغيّر قبل إضافات الهدايا
  let basePrice: number | null = product.base_price_fallback;
  let salePrice: number | null = null;
  let displayPrice: number | null =
    product.variants_min_price ?? product.base_price_fallback;

  if (effectiveVariant) {
    const { base, sale, display } = pickDisplay(effectiveVariant);
    basePrice = base ?? product.base_price_fallback ?? null;
    salePrice = sale ?? null;
    displayPrice = display ?? basePrice ?? null;
  }

  // إضافة extra_price من كل مجموعة addon (كراديو: قيمة واحدة مختارة لكل مجموعة)
  const addonsExtra = React.useMemo(() => {
    let sum = 0;
    for (const g of addonGroups) {
      const chosenId = sel[g.id];
      if (!chosenId) continue;
      const vv = g.values.find((x) => x.id === chosenId);
      if (vv && typeof vv.extra_price === "number") sum += vv.extra_price;
    }
    return sum;
  }, [addonGroups, sel]);

  const finalBase = (basePrice ?? 0) + addonsExtra;
  const finalSale = salePrice != null ? salePrice + addonsExtra : null;
  const finalDisplay = finalSale ?? finalBase;

  /* ========= UI ========= */
  return (
    <div className="space-y-6">
      {/* السعر */}
      <div className="flex items-baseline gap-3">
        {finalSale != null ? (
          <>
            <div className="text-2xl font-bold">{fmt(finalSale)}</div>
            <div className="text-sm line-through text-zinc-400">
              {fmt(finalBase)}
            </div>
          </>
        ) : (
          <div className="text-2xl font-bold">{fmt(finalDisplay)}</div>
        )}
      </div>

      {/* كل المجموعات كراديو */}
      {[...choiceGroups, ...addonGroups].map((g) => (
        <div key={g.id} className="space-y-2">
          <div className="text-sm font-medium">{g.name}</div>
          <div className="grid grid-cols-3 gap-3">
            {g.values.map((v) => {
              const enabled =
                g.kind === "choice" ? isChoiceValueEnabled(g.id, v.id) : true;
              const active = sel[g.id] === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={!enabled}
                  onClick={() => setSel((prev) => ({ ...prev, [g.id]: v.id }))}
                  className={cx(
                    "h-10 rounded-xl border px-6 text-sm font-medium transition",
                    active
                      ? "bg-black text-white border-black"
                      : "bg-white text-zinc-800 border-zinc-300 hover:bg-zinc-50",
                    !enabled && "opacity-40 cursor-not-allowed"
                  )}
                  title={v.label}
                >
                  {v.label}
                  {g.kind === "addon" &&
                    typeof v.extra_price === "number" &&
                    v.extra_price > 0 && (
                      <span className="ml-2 text-[11px] opacity-80">
                        +{fmt(v.extra_price)}
                      </span>
                    )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
