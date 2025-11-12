"use client";
import * as React from "react";

/* ========= Types ========= */
type Value = {
  id: string;
  label: string;
  value_code?: string | null;
  // أسعار كل قيمة (قائمة من الراوت أو محوّلة في page.tsx)
  extra_price?: number | null; // list قبل الخصم
  extra_sale_price?: number | null; // سعر الخصم للقيمة (إن وُجد وأقل من العادي)
  qty_total?: number | null; // إجمالي المتاح لهذه القيمة من variant_inventory (مجمّع عبر الفروع)
  sort_order?: number | null;
};
type Group = {
  id: string;
  name: string;
  kind: "choice" | "addon"; // نتعامل معها كراديو (اختيار واحد)
  display_type?: string | null;
  values: Value[];
};
type Variant = {
  id: string;
  value_ids: string[];
  price?: number | null; // list
  sale_price?: number | null; // sale
  ends_at?: string | null;
  qty_available?: number | null; // إجمالي المتاح لهذا المتغيّر (مجمّع عبر الفروع)
};
type ProductData = {
  id: string;
  base_price_fallback: number | null;
  option_groups: Group[] | null | undefined;
  variants: Variant[] | null | undefined;
};

/* ========= Helpers ========= */
const cx = (...xs: (string | false | undefined)[]) =>
  xs.filter(Boolean).join(" ");
const N = (x: unknown): number | null =>
  x == null ? null : Number.isFinite(Number(x)) ? Number(x) : null;
const fmt = (n: number | null | undefined) =>
  n == null ? "—" : `${new Intl.NumberFormat("ar-EG").format(n)} ر.س`;

function varParts(v?: Variant | null) {
  const list = N(v?.price);
  const sale = N(v?.sale_price);
  const has = list != null && sale != null && sale > 0 && sale < list;
  return {
    list,
    sale: has ? sale : null,
    display: has ? (sale as number) : list,
    qty: v?.qty_available ?? 0,
  };
}
function valueParts(
  v?: Value | null
): { list: number; display: number } | null {
  if (!v) return null;
  const l = N(v.extra_price);
  const s = N(v.extra_sale_price);
  if (s != null && s > 0 && (l == null || s < l))
    return { list: l ?? s, display: s };
  if (l != null && l > 0) return { list: l, display: l };
  return null;
}

/* حدّد مجموعة المقاسات بالاسم أو الأكثر ارتباطًا بالمتغيّرات */
function findPrimaryGroupId(
  groups: Group[],
  variants: Variant[] | null | undefined
) {
  const used = new Set<string>();
  for (const vt of variants || [])
    for (const id of vt.value_ids) used.add(String(id));
  const byName = groups.find((g) =>
    /مقاس|المقاسات|size|sizes/i.test(g.name ?? "")
  );
  if (byName) return byName.id;
  let best: { id: string; hits: number } | null = null;
  for (const g of groups) {
    const hits = (g.values || []).reduce(
      (acc, v) => acc + (used.has(v.id) ? 1 : 0),
      0
    );
    if (!best || hits > best.hits) best = { id: g.id, hits };
  }
  return best && best.hits > 0 ? best.id : null;
}

/* يبدأ من = أرخص متغيّر، وإلا السعر الأساسي (رقم دائمًا) */
function computeStartsFrom(
  variants: Variant[] | null | undefined,
  base: number | null
) {
  let min: number | null = null;
  for (const v of variants || []) {
    // لو ما فيه سعر للمتغيّر نستخدم base كبديل
    const d = varParts(v).display ?? (Number.isFinite(base as any) ? (base as number) : null);
    if (d != null && (min == null || d < min)) min = d;
  }
  const val = Number.isFinite(min as any)
    ? (min as number)
    : Number.isFinite(base as any)
    ? (base as number)
    : 0;

  return {
    list: val,
    sale: null as number | null,
    display: val,
    mode: "from" as const,
    available_qty: 0,
  };
}

/* اجمع السعر: مقاس (من variant) + الإضافات المختارة، واحسب الكمية المتاحة */
function computePricing(
  groups: Group[],
  variants: Variant[] | null | undefined,
  sel: Record<string, string | undefined>,
  base: number | null
) {
  const primaryGroupId = findPrimaryGroupId(groups, variants);
  const primaryValId = primaryGroupId ? sel[primaryGroupId] : undefined;

  // 1) المقاس من المتغيّر
  let chosenVar: Variant | null = null;
  if (primaryValId) {
    chosenVar =
      (variants || []).find((v) => v.value_ids.includes(primaryValId)) || null;
  }
  const vp = varParts(chosenVar);

  // 2) أسعار الإضافات + أقل كمية متاحة بينها
  let addonsList = 0,
    addonsDisplay = 0,
    anyAddon = false;
  let addonMinQty: number | null = null;
  for (const g of groups) {
    if (primaryGroupId && g.id === primaryGroupId) continue;
    const pickedId = sel[g.id];
    if (!pickedId) continue;
    const val = (g.values || []).find((x) => x.id === pickedId);
    const p = valueParts(val);
    if (!p) continue;
    anyAddon = true;
    addonsList += p.list;
    addonsDisplay += p.display;
    const q = val?.qty_total ?? 0;
    addonMinQty = addonMinQty == null ? q : Math.min(addonMinQty, q);
  }

  // 3) تحديد الحالة
  if (!primaryValId && !anyAddon) return computeStartsFrom(variants, base);

  if (!primaryValId && anyAddon) {
    // هدية فقط: السعر = سعر الهدية، الكمية = qty_total للإضافة (أو الأدنى بين الإضافات لو عندك أكثر من مجموعة)
    const list = addonsList;
    const display = addonsDisplay;
    const avail = Math.max(0, addonMinQty ?? 0);
    return {
      list,
      sale: display < list ? display : null,
      display,
      mode: "options" as const,
      available_qty: avail,
    };
  }

  // مقاس + إضافات: السعر = سعر المتغيّر + الإضافات، الكمية = min(كمية المتغيّر, أقل كمّية إضافات مختارة إن وُجدت)
  const list = (vp.list ?? (Number.isFinite(base as any) ? (base as number) : 0)) + addonsList;
  const display = (vp.display ?? (Number.isFinite(base as any) ? (base as number) : 0)) + addonsDisplay;
  const avail =
    addonMinQty == null
      ? vp.qty ?? 0
      : Math.min(vp.qty ?? 0, Math.max(0, addonMinQty));
  return {
    list,
    sale: display < list ? display : null,
    display,
    mode: "options" as const,
    available_qty: avail,
  };
}

/* ========= Component ========= */
export default function OptionsPicker({ product }: { product: ProductData }) {
  const groups = Array.isArray(product.option_groups)
    ? product.option_groups
    : [];
  const variants = Array.isArray(product.variants) ? product.variants : [];

  const [sel, setSel] = React.useState<Record<string, string | undefined>>({});

  // أول تحميل: لو ما فيه مجموعات، نعتمد على المتغيّرات فقط ونبثّ السعر والكمية الإجمالية
  React.useEffect(() => {
    if (groups.length === 0) {
      // مجموع الكميات عبر كل المتغيّرات (عبر الفروع)
      const totalAvail = (variants || []).reduce(
        (acc, v) => acc + (v.qty_available ?? 0),
        0
      );
      // اختر أفضل متغيّر للإضافة (أكبر كمية ثم أرخص سعر كتعادل)
      let best: Variant | null = null;
      let bestScore: [number, number] | null = null; // sort by (-qty, display)
      for (const v of variants || []) {
        const vp = varParts(v);
        const disp = vp.display ?? Number.POSITIVE_INFINITY;
        const score: [number, number] = [-(vp.qty ?? 0), disp];
        if (!best || (bestScore && score < bestScore)) {
          best = v;
          bestScore = score;
        }
      }
      const vp = varParts(best);
      const display = (vp.display ?? product.base_price_fallback ?? 0);
      const list = (vp.list ?? product.base_price_fallback ?? 0);
      const sale = vp.sale ?? null;

      // ابثّ للزر والسعر: available_qty = إجمالي الكميات
      window.dispatchEvent(
        new CustomEvent("selection-changed", {
          detail: {
            product_id: product.id,
            variant_id: best?.id ?? null,
            selections: {},
            pricing: {
              list,
              sale,
              display,
              mode: "options",
              available_qty: Math.max(0, totalAvail),
            },
          },
        })
      );
      return;
    }

    // إن وُجدت مجموعات: ابثّ “يبدأ من …” بإطار مؤجّل لضمان عدم انقلابها إلى "base"
    const p = computeStartsFrom(variants, product.base_price_fallback);
    requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent("selection-changed", {
          detail: {
            product_id: product.id,
            variant_id: null,
            selections: {},
            pricing: p, // p.mode === "from"
          },
        })
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.length, variants.length, product.id, product.base_price_fallback]);

  // نقر أي خيار: نحدّث الاختيارات ونبثّ السعر والكمية فورًا
  const pick = (g: Group, v: Value) => {
    const nextSel = { ...sel, [g.id]: v.id };
    setSel(nextSel);

    const primaryGroupId = findPrimaryGroupId(groups, variants);
    const primaryValId = primaryGroupId ? nextSel[primaryGroupId] : undefined;
    const exact = primaryValId
      ? (variants || []).find((vt) => vt.value_ids.includes(primaryValId!)) ||
        null
      : null;

    const pricing = computePricing(
      groups,
      variants,
      nextSel,
      product.base_price_fallback
    );

    window.dispatchEvent(
      new CustomEvent("selection-changed", {
        detail: {
          product_id: product.id,
          variant_id: exact?.id ?? null,
          selections: nextSel,
          pricing,
        },
      })
    );
  };

  // أي تغيّر لاحق
  React.useEffect(() => {
    if (groups.length === 0) return; // حالة بدون مجموعات تمّت أعلاه
    const pricing = computePricing(
      groups,
      variants,
      sel,
      product.base_price_fallback
    );
    window.dispatchEvent(
      new CustomEvent("selection-changed", {
        detail: {
          product_id: product.id,
          variant_id: null,
          selections: sel,
          pricing,
        },
      })
    );
  }, [sel, groups, variants, product.base_price_fallback, product.id]);

  const primaryGroupId = findPrimaryGroupId(groups, variants);

  return (
    <div id="options-root" className="space-y-6 scroll-mt-24">
      {/* لا نرسم أي شيء لو ما في مجموعات */}
      {groups.map((g) => (
        <div key={g.id} className="space-y-2">
          <div className="text-sm font-medium">{g.name}</div>
          <div className="grid grid-cols-3 gap-3">
            {(g.values || []).map((v) => {
              const active = sel[g.id] === v.id;
              const parts = valueParts(v);
              const isPrimary = g.id === primaryGroupId;
              const qty = v.qty_total ?? 0;
              const soldOut = isPrimary ? qty <= 0 : false;

              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={soldOut}
                  onClick={() => !soldOut && pick(g as Group, v)}
                  className={cx(
                    "relative h-11 rounded-xl border px-3 text-sm transition grid place-items-center",
                    active
                      ? "bg-black text-white border-black"
                      : "bg-white text-zinc-800 border-zinc-300 hover:bg-zinc-50",
                    soldOut && "opacity-45 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {/* اسم المقاس */}
                    <span
                      className={cx("font-medium", soldOut && "line-through")}
                    >
                      {v.label}
                    </span>
                    {/* الكمية للمقاسات فقط */}
                    {isPrimary && (
                      <span className="text-[10px] text-zinc-500">({qty})</span>
                    )}
                    {/* فاصل */}
                    {parts && <span className="text-zinc-300">·</span>}
                    {/* السعر المصغّر */}
                    {parts && (
                      <span
                        className={cx(
                          "text-[11px] opacity-80",
                          soldOut && "opacity-50"
                        )}
                      >
                        {parts.display < (parts.list ?? 0) ? (
                          <>
                            <span className="line-through mr-1">
                              {fmt(parts.list)}
                            </span>
                            <span>{fmt(parts.display)}</span>
                          </>
                        ) : (
                          <>+{fmt(parts.display)}</>
                        )}
                      </span>
                    )}
                  </div>
                  {/* شارة نفدت للمقاس المنتهي */}
                  {soldOut && (
                    <span className="absolute -top-1.5 -left-1.5 rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-rose-200">
                      نفدت
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
