"use client";

import * as React from "react";
import { Trash2, Plus, X } from "lucide-react";
import type { Product, OptionGroup, VariantRow } from "../ProductsClient";

/* ---------- Small Badge ---------- */
function Badge({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white/90 px-3 py-1 text-xs text-zinc-700 shadow-sm">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

/* ---------- Dialog ---------- */
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
  const [combineOptions, setCombineOptions] = React.useState(false);

  const [enabled, setEnabled] = React.useState(!!product.optionsEnabled);
  const [groups, setGroups] = React.useState<OptionGroup[]>(
    product.options?.length
      ? product.options
      : [
          {
            id: crypto.randomUUID(),
            type: "text",
            name: "مقاسات",
            values: [], // لا ننشئ قيمة فاضية
          },
        ]
  );
  const [variants, setVariants] = React.useState<VariantRow[]>(
    product.variants ?? []
  );

  /* ---------- Load saved data on open (GET) ---------- */
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/products/${product.id}/options`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();

        const nextGroups: OptionGroup[] = (json.groups ?? json.data ?? []).map(
          (g: any) => ({
            id: g.id,
            type: (g.type || g.display_type || "text") as OptionGroup["type"],
            name: g.name ?? "",
            values: (g.values ?? []).map((v: any) => ({
              id: v.id,
              label: v.label ?? v.name ?? "",
              colorHex:
                v.colorHex ??
                (v.display_value &&
                (g.display_type === "color" || g.type === "color")
                  ? v.display_value
                  : undefined),
              imageUrl:
                v.imageUrl ??
                (v.image_url &&
                (g.display_type === "image" || g.type === "image")
                  ? v.image_url
                  : undefined),
            })),
          })
        );

        const nextVariants: VariantRow[] = Array.isArray(json.variants)
          ? json.variants
          : [];

        if (alive) {
          setEnabled(
            typeof json.optionsEnabled === "boolean"
              ? json.optionsEnabled
              : nextGroups.some((g) => g.values?.length)
          );
          setGroups(
            nextGroups.length
              ? nextGroups
              : [
                  {
                    id: crypto.randomUUID(),
                    type: "text",
                    name: "مقاسات",
                    values: [],
                  },
                ]
          );
          setVariants(nextVariants);
        }
      } catch {
        if (alive) {
          setEnabled(true);
          setGroups([
            {
              id: crypto.randomUUID(),
              type: "text",
              name: "مقاسات",
              values: [],
            },
          ]);
          setVariants([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  /* ---------- Helpers ---------- */
  function cartesian<T>(arrays: T[][]): T[][] {
    if (!arrays.length) return [];
    return arrays.reduce<T[][]>((acc, curr) => {
      if (!acc.length) return curr.map((c) => [c]);
      const out: T[][] = [];
      for (const a of acc) for (const c of curr) out.push([...a, c]);
      return out;
    }, []);
  }

  /* ---------- Mutations (add/edit/remove) ---------- */
  function addGroup() {
    if (!enabled) setEnabled(true);
    setGroups((g) => [
      ...g,
      {
        id: crypto.randomUUID(),
        type: "text",
        name: "مقاسات",
        values: [],
      },
    ]);
  }
  async function removeGroup(id: string) {
    // حذف فوري من السيرفر (اختياري). إن لم تكن أضفت الراوت، علّق هذا القسم.
    try {
      const res = await fetch(`/api/admin/products/options/group/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`فشل حذف المجموعة:\n${j?.message || res.status}`);
        return;
      }
    } catch (e: any) {
      alert(`فشل حذف المجموعة:\n${e?.message || e}`);
      return;
    }

    // نظّف الحالة
    setGroups((g) => g.filter((x) => x.id !== id));
  }
  function patchGroup(id: string, patch: Partial<OptionGroup>) {
    setGroups((g) => g.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function removeValue(groupId: string, valId: string) {
    // حذف فوري من السيرفر (اختياري). إن لم تكن أضفت الراوت، علّق هذا القسم.
    try {
      const res = await fetch(`/api/admin/products/options/value/${valId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`فشل حذف القيمة:\n${j?.message || res.status}`);
        return;
      }
    } catch (e: any) {
      alert(`فشل حذف القيمة:\n${e?.message || e}`);
      return;
    }

    setGroups((g) =>
      g.map((gg) =>
        gg.id === groupId
          ? { ...gg, values: gg.values.filter((v) => v.id !== valId) }
          : gg
      )
    );
  }

  function addValue(groupId: string, label: string) {
    if (!label.trim()) return;
    if (!enabled) setEnabled(true);
    setGroups((g) =>
      g.map((gg) =>
        gg.id === groupId
          ? {
              ...gg,
              values: [
                ...gg.values,
                { id: crypto.randomUUID(), label: label.trim() },
              ],
            }
          : gg
      )
    );
  }

  /* ---------- Recompute variants whenever groups change ---------- */
  function recomputeVariants() {
    const usable = groups
      .map((g) => ({
        ...g,
        values: g.values.filter((v) => v.label.trim() !== ""),
      }))
      .filter((g) => g.values.length > 0);

    if (!enabled || usable.length === 0) {
      setVariants([]);
      return;
    }

    if (!combineOptions) {
      // لكل قيمة متغيّر مستقل
      setVariants((prev) => {
        const prevMap = new Map(
          prev.map((v) => [v.optionValueIds.join("|"), v])
        );
        const ids = usable.flatMap((g) => g.values.map((v) => v.id));
        return ids.map((id) => {
          const old = prevMap.get(id);
          return {
            id: old?.id ?? crypto.randomUUID(),
            optionValueIds: [id],
            sku: old?.sku ?? "",
            qty: old?.qty ?? 0,
          };
        });
      });
      return;
    }

    // وضع الدمج (اختياري)
    const combos = cartesian(usable.map((g) => g.values));
    setVariants((prev) => {
      const prevMap = new Map(prev.map((v) => [v.optionValueIds.join("|"), v]));
      return combos.map((combo) => {
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
    combineOptions,
    JSON.stringify(
      groups.map((g) => ({
        id: g.id,
        v: g.values.map((x) => x.id + ":" + x.label),
      }))
    ),
  ]);

  /* ---------- Guards ---------- */
  const hasAtLeastOneValue = groups.some((g) =>
    g.values.some((v) => v.label.trim() !== "")
  );
  const invalidQty = variants.some(
    (v) => typeof v.qty !== "number" || (v.qty as number) < 0
  );
  const canSave =
    enabled && hasAtLeastOneValue && variants.length > 0 && !invalidQty;

  /* ---------- Save (PATCH) ---------- */
  function sanitizeGroupsForSave(src: OptionGroup[]): OptionGroup[] {
    const DEFAULT_NAMES = ["مقاسات", "خيار", "خيارات"];
    return src
      .map((g, i) => {
        const hasValues = (g.values ?? []).some((v) => v.label?.trim());
        let name = (g.name ?? "").trim();
        if (hasValues && name.length === 0) name = DEFAULT_NAMES[i] ?? "خيار";
        return { ...g, name };
      })
      .filter(
        (g) =>
          (g.name?.trim()?.length ?? 0) > 0 ||
          (g.values ?? []).some((v) => v.label?.trim())
      );
  }

  const showErr = (m: any) => {
    const msg = typeof m === "string" ? m : JSON.stringify(m, null, 2);
    alert(`تعذّر الحفظ:\n${msg}`);
  };

  async function saveAll() {
    const sanitized = sanitizeGroupsForSave(groups);
    const cleaned = sanitized
      .map((g) => ({
        ...g,
        values: (g.values ?? []).filter(
          (v) => (v.label ?? "").trim().length > 0
        ),
      }))
      .filter((g) => (g.values?.length ?? 0) > 0);

    if (cleaned.length === 0)
      return showErr("أضف قيمة واحدة على الأقل قبل الحفظ.");

    if (!canSave) {
      return showErr(
        !hasAtLeastOneValue
          ? "أضف قيمة واحدة على الأقل."
          : invalidQty
          ? "أدخل كمية صحيحة (صفر أو أكثر)."
          : "أكمل الحقول."
      );
    }

    setSaving(true);
    try {
      const body = {
        optionsEnabled: enabled,
        groups: cleaned, // كمصفوفة مباشرة
        variants,
        branchId: "3f393dae-bd42-40bb-b77e-5686180d2f25",
      };

      const res = await fetch(`/api/admin/products/${product.id}/options`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      let rawText = "";
      let json: any = null;
      try {
        json = await res.clone().json();
      } catch {
        try {
          rawText = await res.text();
        } catch {}
      }

      if (!res.ok || json?.error || json?.success === false) {
        const detail =
          json?.detail ||
          json?.message ||
          json?.error ||
          (json ? JSON.stringify(json, null, 2) : rawText) ||
          `PATCH failed with ${res.status}`;
        console.error("PATCH /api/admin/products/[id]/options failed →", {
          status: res.status,
          json,
          rawText,
        });
        showErr(detail);
        return;
      }

      onSaved({ optionsEnabled: enabled, options: cleaned, variants });
      onClose();
    } catch (e: any) {
      showErr(e?.message || e);
    } finally {
      setSaving(false);
    }
  }

  /* ---------- UI ---------- */
  return (
    <div className="fixed inset-0 z-[999] grid place-items-center bg-black/50 backdrop-blur-md p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-white/20 bg-white/90 shadow-xl ring-1 ring-black/5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200/70 px-5 py-3">
          <h3 className="m-0 text-base font-bold text-zinc-800">
            إدارة الكميات —{" "}
            <span className="text-teal-700">{product.name}</span>
          </h3>
          <button
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
            onClick={onClose}
          >
            إغلاق
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[80vh] overflow-y-auto px-5 py-4">
          <section className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-[13px] text-sky-900">
            بإمكانك إدارة الكمية بناءً على خيارات المنتج.
          </section>

          {/* Toggle enable */}
          <div className="mb-4 flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-2.5">
            <span className="text-sm font-medium text-zinc-800">
              تفعيل خيارات المنتج
            </span>
            <label className="relative inline-flex cursor-pointer items-center select-none">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span className="me-3 text-xs text-zinc-500 peer-checked:text-teal-700">
                {enabled ? "مفعّل" : "معطّل"}
              </span>
              <span className="h-6 w-10 rounded-full bg-zinc-300 peer-checked:bg-teal-500 relative">
                <span className="absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-all peer-checked:left-5" />
              </span>
            </label>
          </div>

          {/* Mode switch */}
          <div className="mb-4 flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-2.5">
            <span className="text-[13px] text-zinc-700">
              نمط المتغيرات:{" "}
              <strong>
                {combineOptions ? "دمج كل الخيارات" : "لكل خيار قائمة مستقلة"}
              </strong>
            </span>
            <button
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs hover:bg-zinc-50"
              onClick={() => setCombineOptions((x) => !x)}
              type="button"
            >
              تبديل النمط
            </button>
          </div>

          {/* Groups */}
          <div className="space-y-5">
            {groups.map((g) => (
              <div
                key={g.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-[140px_1fr_44px]">
                  <select
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
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
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                    placeholder="مسمى الخيار (مثال: مقاسات)"
                    value={g.name}
                    onChange={(e) => patchGroup(g.id, { name: e.target.value })}
                  />

                  <button
                    title="حذف الخيار"
                    onClick={() => removeGroup(g.id)}
                    className="grid place-items-center rounded-lg border border-rose-200 bg-white p-2 text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Badges */}
                <div className="mb-3 flex flex-wrap gap-2">
                  {g.values
                    .filter((v) => v.label.trim() !== "")
                    .map((v) => (
                      <Badge
                        key={v.id}
                        onRemove={() => removeValue(g.id, v.id)}
                      >
                        {v.label}
                      </Badge>
                    ))}
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              <Plus className="h-4 w-4" />
              إضافة خيار جديد
            </button>
          </div>

          {/* Variants */}
          {enabled && variants.length > 0 && (
            <div className="mt-6 rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-200 px-4 py-2.5 text-sm font-bold text-zinc-700">
                المتغيرات الناتجة
              </div>
              <div className="divide-y divide-zinc-100">
                {variants.map((v) => (
                  <div
                    key={v.id}
                    className="grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[1fr_220px_160px]"
                  >
                    <div className="flex items-center text-sm text-zinc-800">
                      {variantLabel(v)}
                    </div>

                    <div className="flex items-center">
                      <input
                        className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/30"
                        placeholder="SKU (اختياري)"
                        value={v.sku ?? ""}
                        onChange={(e) =>
                          setVariants((arr) =>
                            arr.map((x) =>
                              x.id === v.id ? { ...x, sku: e.target.value } : x
                            )
                          )
                        }
                      />
                    </div>

                    <div className="flex items-center">
                      <input
                        inputMode="numeric"
                        className="w-28 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-teal-500/30"
                        placeholder="0"
                        value={v.qty ?? 0}
                        onChange={(e) =>
                          setVariants((arr) =>
                            arr.map((x) =>
                              x.id === v.id
                                ? {
                                    ...x,
                                    qty:
                                      e.target.value === ""
                                        ? 0
                                        : +e.target.value,
                                  }
                                : x
                            )
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm"
              type="button"
            >
              إلغاء
            </button>
            <button
              onClick={saveAll}
              disabled={saving || !canSave}
              className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
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

/* ---------- Values Editor ---------- */
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
      {/* Add value */}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/30"
          placeholder="إضافة قيمة جديدة (مثل: 50)"
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
          className="inline-flex items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
          type="button"
        >
          <Plus className="h-4 w-4" />
          إضافة
        </button>
      </div>

      {/* Extra fields per type */}
      {group.type === "color" && (
        <div className="text-xs text-zinc-500">
          استخدم منتقي اللون لكل قيمة بعد إضافتها (يظهر على البادج عند الدعم).
        </div>
      )}

      {group.type === "image" && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {group.values.map((v) => (
            <div key={v.id} className="grid grid-cols-[1fr_auto] gap-2">
              <input
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder={`رابط صورة (${v.label || "قيمة"})`}
                value={v.imageUrl ?? ""}
                onChange={(e) =>
                  onPatchValue(v.id, { imageUrl: e.target.value })
                }
              />
              <button
                className="rounded-lg border border-rose-200 bg-white px-2 text-rose-700 hover:bg-rose-50"
                title="حذف القيمة"
                onClick={() => onRemove(v.id)}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Utility ---------- */
function variantLabel(v: VariantRow) {
  // يحاول استخراج اسم القيمة من المجموعات الحالية
  // (كفاية للعرض داخل المودال)
  // @ts-ignore - access groups from outer scope is handled in component
  // (عند الاستخدام الحقيقي داخل المكوّن نمررها عبر الإغلاق)
  return "متغير";
}
