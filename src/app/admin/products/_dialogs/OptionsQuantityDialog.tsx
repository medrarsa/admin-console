"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import type { Product, OptionGroup, VariantRow } from "../ProductsClient";

export default function OptionsQuantityDialog({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved: (patch: Partial<Product>) => void;
}) {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [enabled, setEnabled] = React.useState(!!product.optionsEnabled);
  const [groups, setGroups] = React.useState<OptionGroup[]>(
    product.options?.length
      ? product.options
      : [{ id: crypto.randomUUID(), type: "text", name: "مقاس", values: [{ id: crypto.randomUUID(), label: "" }] }]
  );
  const [variants, setVariants] = React.useState<VariantRow[]>(
    product.variants ?? []
  );

  // --------- عند الفتح: جلب الخيارات من الـ API ----------
  React.useEffect(() => {
    let alive = true;
    async function fetchOptions() {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/products/${product.id}/options`, { method: "GET" });
        if (!res.ok) throw new Error(`GET failed with ${res.status}`);
        const json = await res.json();

        let nextGroups: OptionGroup[] = groups;
        let nextVariants: VariantRow[] = variants;
        let nextEnabled = enabled;

        if (json?.data && Array.isArray(json.data)) {
          // صيغة سلة: data = قائمة خيارات
          const parsed: OptionGroup[] = json.data.map((o: any) => ({
            id: o.id,
            type: (o.display_type ?? "text") as OptionGroup["type"],
            name: o.name ?? "",
            values: Array.isArray(o.values)
              ? o.values.map((v: any) => ({
                  id: v.id,
                  label: v.name ?? "",
                  colorHex:
                    (o.display_type === "color" ? v.display_value : undefined) ?? undefined,
                  imageUrl:
                    (o.display_type === "image" ? v.image_url : undefined) ?? undefined,
                }))
              : [],
          }));

          if (parsed.length === 0) {
            // ما فيه خيارات محفوظة: جهّز افتراضي
            nextGroups = [
              {
                id: crypto.randomUUID(),
                type: "text",
                name: "مقاس",
                values: [{ id: crypto.randomUUID(), label: "" }],
              },
            ];
            nextVariants = [];
            nextEnabled = true;
          } else {
            nextGroups = parsed;
            nextVariants = variants;
            nextEnabled = parsed.some((g) => g.values.length > 0);
          }
        } else if (
          typeof json?.optionsEnabled !== "undefined" &&
          Array.isArray(json?.groups) &&
          Array.isArray(json?.variants)
        ) {
          // صيغة بديلة: optionsEnabled + groups + variants
          nextEnabled = !!json.optionsEnabled;
          nextGroups = json.groups;
          nextVariants = json.variants;

          if (nextGroups.length === 0) {
            nextGroups = [
              {
                id: crypto.randomUUID(),
                type: "text",
                name: "مقاس",
                values: [{ id: crypto.randomUUID(), label: "" }],
              },
            ];
            nextVariants = [];
            nextEnabled = true;
          }
        } else {
          // رد غير متوقع -> افتراضي
          nextGroups = [
            {
              id: crypto.randomUUID(),
              type: "text",
              name: "مقاس",
              values: [{ id: crypto.randomUUID(), label: "" }],
            },
          ];
          nextVariants = [];
          nextEnabled = true;
        }

        if (alive) {
          setEnabled(nextEnabled);
          setGroups(nextGroups);
          setVariants(nextVariants);
        }
      } catch {
        // في حال الفشل، نحتفظ بالافتراضي
        if (alive) {
          setEnabled(true);
          setGroups([
            { id: crypto.randomUUID(), type: "text", name: "مقاس", values: [{ id: crypto.randomUUID(), label: "" }] },
          ]);
          setVariants([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    fetchOptions();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  React.useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  function addGroup() {
    if (!enabled) setEnabled(true);
    setGroups((g) => [
      ...g,
      { id: crypto.randomUUID(), type: "text", name: "مقاس", values: [{ id: crypto.randomUUID(), label: "" }] },
    ]);
  }
  function removeGroup(id: string) {
    setGroups((g) => g.filter((x) => x.id !== id));
  }
  function patchGroup(id: string, patch: Partial<OptionGroup>) {
    setGroups((g) => g.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function addValue(groupId: string, label: string) {
    if (!label.trim()) return;
    if (!enabled) setEnabled(true);
    setGroups((g) =>
      g.map((gg) =>
        gg.id === groupId
          ? {
              ...gg,
              values: [...gg.values, { id: crypto.randomUUID(), label: label.trim() }],
            }
          : gg
      )
    );
  }
  function removeValue(groupId: string, valId: string) {
    setGroups((g) =>
      g.map((gg) =>
        gg.id === groupId ? { ...gg, values: gg.values.filter((v) => v.id !== valId) } : gg
      )
    );
  }

  function cartesian<T>(arrays: T[][]): T[][] {
    if (!arrays.length) return [];
    return arrays.reduce<T[][]>((acc, curr) => {
      if (!acc.length) return curr.map((c) => [c]);
      const out: T[][] = [];
      for (const a of acc) for (const c of curr) out.push([...a, c]);
      return out;
    }, []);
  }

  function recomputeVariants() {
    const usable = groups.filter((g) => g.values.length > 0);
    if (!enabled || usable.length === 0) {
      setVariants([]);
      return;
    }
    const combos = cartesian(usable.map((g) => g.values));
    setVariants((prev) => {
      const prevMap = new Map(prev.map((v) => [v.optionValueIds.join("|"), v]));
      return combos.map((combo: OptionGroup["values"]) => {
        const key = combo.map((c) => c.id).join("|");
        const old = prevMap.get(key);
        return {
          id: old?.id ?? crypto.randomUUID(),
          optionValueIds: combo.map((c) => c.id),
          sku: old?.sku ?? "",
          qty: old?.qty ?? 0,
        };
      });
    });
  }

  React.useEffect(() => {
    recomputeVariants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    JSON.stringify(groups.map((g) => ({ id: g.id, v: g.values.map((x) => x.id) }))),
  ]);

  async function saveAll() {
    setSaving(true);
    try {
      const body = {
        optionsEnabled: enabled,
        groups,
        variants,
        branchId: "3f393dae-bd42-40bb-b77e-5686180d2f25", // فرع MAIN
      };
      const res = await fetch(`/api/admin/products/${product.id}/options`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json?.error) {
        throw new Error(json?.error || `PATCH failed with ${res.status}`);
      }
      onSaved({ optionsEnabled: enabled, options: groups, variants });
      onClose();
    } catch (e) {
      console.error(e);
      alert("تعذّر الحفظ. تحقّق من الاتصال والصلاحيات وفرع المخزون.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[999] grid place-items-center bg-black/50 backdrop-blur-md p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-white/20 bg-white/80 shadow-[0_20px_60px_-10px_rgba(0,0,0,.35)] ring-1 ring-black/5 supports-[backdrop-filter]:bg-white/60">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/30 bg-gradient-to-l from-teal-600/10 via-sky-500/10 to-fuchsia-500/10 px-5 py-4">
          <h3 className="m-0 text-base font-extrabold tracking-tight">
            <span className="bg-gradient-to-l from-teal-600 via-sky-600 to-fuchsia-600 bg-clip-text text-transparent">
              الخيارات والكمية
            </span>{" "}
            — <span className="text-zinc-800">{product.name}</span>
          </h3>
          <div className="flex items-center gap-2">
            {loading && <span className="text-xs text-zinc-500">جاري التحميل…</span>}
            {saving && <span className="text-xs text-teal-700">جاري الحفظ…</span>}
            <button
              className="rounded-xl border border-zinc-200/60 bg-white/80 px-3 py-1.5 text-sm hover:bg-zinc-50/80 transition-colors"
              onClick={onClose}
            >
              إغلاق
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[80vh] overflow-y-auto px-5 py-4 scroll-smooth">
          <div className="mb-4 rounded-xl border border-sky-200/60 bg-sky-50/80 px-3.5 py-2.5 text-[13px] text-sky-900 shadow-sm">
            بإمكانك إدارة الكمية بناءً على خيارات المنتج.
          </div>

          <div className="mb-5 flex items-center justify-between rounded-xl border border-zinc-200/70 bg-white/70 px-4 py-3 shadow-sm">
            <span className="text-sm font-semibold text-zinc-800">تفعيل خيارات المنتج</span>
            <label className="relative inline-flex cursor-pointer items-center select-none">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span className="me-3 text-xs text-zinc-500 peer-checked:text-teal-700 transition-colors">
                {enabled ? "مفعّل" : "معطّل"}
              </span>
              <span className="h-7 w-12 rounded-full bg-zinc-300/70 peer-checked:bg-teal-500/80 transition-colors relative shadow-inner">
                <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow ring-1 ring-black/5 transition-all peer-checked:left-6" />
              </span>
            </label>
          </div>

          {/* Option Groups */}
          <div className="space-y-4">
            {groups.map((g) => (
              <div
                key={g.id}
                className="rounded-2xl border border-zinc-200/70 bg-white/80 p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr_44px]">
                  <select
                    className="rounded-xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500/40 transition"
                    value={g.type}
                    onChange={(e) =>
                      patchGroup(g.id, {
                        type: e.target.value as OptionGroup["type"],
                      })
                    }
                  >
                    <option value="text">نص</option>
                    <option value="color">اللون</option>
                    <option value="image">صورة</option>
                  </select>

                  <input
                    className="rounded-xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/40 transition"
                    placeholder="مسمى الخيار (مثل اللون، المقاس)"
                    value={g.name}
                    onChange={(e) => {
                      if (!enabled && e.target.value.trim()) setEnabled(true);
                      patchGroup(g.id, { name: e.target.value });
                    }}
                  />

                  <button
                    title="حذف الخيار"
                    onClick={() => removeGroup(g.id)}
                    className="grid place-items-center rounded-xl border border-rose-200/70 bg-white/80 p-2 text-rose-700 hover:bg-rose-50/80 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Values Editor */}
                <ValuesEditor
                  group={g}
                  onAdd={(label) => addValue(g.id, label)}
                  onRemove={(valId) => removeValue(g.id, valId)}
                  onPatchValue={(valId, patch) =>
                    setGroups((arr) =>
                      arr.map((gg) =>
                        gg.id !== g.id
                          ? gg
                          : {
                              ...gg,
                              values: gg.values.map((v) =>
                                v.id === valId ? { ...v, ...patch } : v
                              ),
                            }
                      )
                    )
                  }
                />
              </div>
            ))}

            <button
              onClick={addGroup}
              className="w-full rounded-2xl border border-zinc-200/70 bg-white/80 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50/80 shadow-sm transition"
            >
              + إضافة خيار جديد
            </button>
          </div>

          {/* Variants Table */}
          {enabled && variants.length > 0 && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/80 shadow-sm">
              <div className="border-b border-zinc-200/70 bg-gradient-to-l from-zinc-50 to-white px-4 py-2.5 text-sm font-bold text-zinc-700">
                المتغيرات الناتجة
              </div>
              <div className="max-h-[40vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
                    <tr className="border-b border-zinc-200/70 text-zinc-600">
                      <th className="px-3 py-2 text-start font-semibold">المتغير</th>
                      <th className="px-3 py-2 text-start font-semibold">SKU</th>
                      <th className="px-3 py-2 text-start font-semibold">الكمية</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v, i) => {
                      const label = v.optionValueIds
                        .map((id, idx) => {
                          const gg = groups[idx];
                          const val = gg?.values.find((vv) => vv.id === id);
                          return gg && val ? `${gg.name || "خيار"}: ${val.label}` : "";
                        })
                        .filter(Boolean)
                        .join(" — ");

                      return (
                        <tr
                          key={v.id}
                          className="border-b border-zinc-100/80 odd:bg-white/60 even:bg-zinc-50/40"
                        >
                          <td className="px-3 py-2 text-zinc-800">
                            {label || `متغير #${i + 1}`}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="w-full rounded-lg border border-zinc-200/70 bg-white/80 px-2.5 py-1.5 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/40 transition"
                              value={v.sku ?? ""}
                              onChange={(e) =>
                                setVariants((arr) =>
                                  arr.map((x) => (x.id === v.id ? { ...x, sku: e.target.value } : x))
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              inputMode="numeric"
                              className="w-28 rounded-lg border border-zinc-200/70 bg-white/80 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-teal-500/40 transition"
                              value={v.qty ?? 0}
                              onChange={(e) =>
                                setVariants((arr) =>
                                  arr.map((x) =>
                                    x.id === v.id
                                      ? { ...x, qty: e.target.value === "" ? 0 : +e.target.value }
                                      : x
                                  )
                                )
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-zinc-200/70 bg-white/80 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50/80 shadow-sm transition"
              type="button"
            >
              إلغاء
            </button>
            <button
              onClick={saveAll}
              disabled={saving}
              className="rounded-xl bg-gradient-to-l from-teal-600 to-sky-600 px-6 py-2 text-sm font-semibold text-white shadow hover:brightness-[1.05] active:brightness-95 transition disabled:opacity-60"
              type="button"
            >
              {saving ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ValuesEditor({
  group,
  onAdd,
  onRemove,
  onPatchValue,
}: {
  group: OptionGroup;
  onAdd: (label: string) => void;
  onRemove: (valId: string) => void;
  onPatchValue: (
    valId: string,
    patch: Partial<{ label: string; colorHex?: string; imageUrl?: string }>
  ) => void;
}) {
  const [valLabel, setValLabel] = React.useState("");

  return (
    <div className="space-y-3">
      {group.values.map((v) => (
        <div
          key={v.id}
          className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_1fr_44px] items-center"
        >
          <input
            className="rounded-xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/40 transition"
            placeholder="القيمة"
            value={v.label}
            onChange={(e) => {
              if (e.target.value.trim()) {
                // فعّل تلقائيًا
                // eslint-disable-next-line no-undef
                // @ts-ignore
                // enabled state موجود بالأب؛ هذا مجرد ضمان إذا تغيّر التنفيذ
              }
              onPatchValue(v.id, { label: e.target.value });
            }}
          />

          {group.type === "color" ? (
            <input
              type="color"
              className="h-10 w-full rounded-xl border border-zinc-200/70 bg-white/80 p-1"
              value={v.colorHex ?? "#ffffff"}
              onChange={(e) => onPatchValue(v.id, { colorHex: e.target.value })}
            />
          ) : (
            <div className="hidden sm:block text-center text-xs text-zinc-400">—</div>
          )}

          {group.type === "image" ? (
            <input
              className="rounded-xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/40 transition"
              placeholder="رابط صورة"
              value={v.imageUrl ?? ""}
              onChange={(e) => onPatchValue(v.id, { imageUrl: e.target.value })}
            />
          ) : (
            <div className="hidden sm:block text-center text-xs text-zinc-400">—</div>
          )}

          <button
            title="حذف القيمة"
            onClick={() => onRemove(v.id)}
            className="grid place-items-center rounded-xl border border-rose-200/70 bg-white/80 p-2 text-rose-700 hover:bg-rose-50/80 transition"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          className="rounded-xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/40 transition"
          placeholder="إضافة قيمة جديدة"
          value={valLabel}
          onChange={(e) => setValLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valLabel.trim()) {
              onAdd(valLabel.trim());
              setValLabel("");
            }
          }}
        />
        <button
          onClick={() => {
            if (!valLabel.trim()) return;
            onAdd(valLabel.trim());
            setValLabel("");
          }}
          className="rounded-xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50/80 shadow-sm transition"
        >
          + إضافة
        </button>
      </div>
    </div>
  );
}
