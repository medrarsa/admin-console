"use client";

import * as React from "react";
import { Trash2, Plus, X } from "lucide-react";
import type { Product, OptionGroup, VariantRow } from "../ProductsClient";

/* توسيع نوع المتغير محليًا لدعم السعر */
type VariantRowWithPrice = VariantRow & { price?: number | null };

/* Badge البسيطة */
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

/* صف جدول القيم داخل كل مجموعة */
type Row = {
  id: string;
  label: string;
  sku?: string;
  qty: number;
  price?: number;
};

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
      : [{ id: crypto.randomUUID(), type: "text", name: "مقاسات", values: [] }]
  );

  // جدول صفوف لكل مجموعة
  const [rowsByGroup, setRowsByGroup] = React.useState<Record<string, Row[]>>(
    {}
  );
  const [variants, setVariants] = React.useState<VariantRowWithPrice[]>(
    (product.variants as VariantRowWithPrice[]) ?? []
  );

  /* ---------- قراءة من السيرفر (GET) وبناء صفوف الجداول ---------- */
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

        const nextVariants: VariantRowWithPrice[] = Array.isArray(json.variants)
          ? (json.variants as VariantRowWithPrice[])
          : [];

        // بناء rows لكل مجموعة (قيمة = متغير واحد)
        const map: Record<string, Row[]> = {};
        for (const g of nextGroups) {
          const rows: Row[] = [];
          for (const val of g.values) {
            const v2 = nextVariants.find(
              (vv) =>
                Array.isArray(vv.optionValueIds) &&
                vv.optionValueIds.length === 1 &&
                vv.optionValueIds[0] === val.id
            );
            const price =
              v2 && typeof (v2 as any)?.price === "number"
                ? Number((v2 as any).price)
                : undefined;

            rows.push({
              id: val.id,
              label: val.label ?? "",
              sku: v2?.sku ?? "",
              qty: Number(v2?.qty ?? 0),
              price,
            });
          }
          map[g.id] = rows;
        }

        if (!alive) return;
        setEnabled(
          typeof json.optionsEnabled === "boolean"
            ? json.optionsEnabled
            : nextGroups.some((gg) => (map[gg.id]?.length || 0) > 0)
        );
        setGroups(nextGroups.length ? nextGroups : groups);
        setRowsByGroup(map);
        setVariants(nextVariants);
      } catch {
        /* إبقِ الحالة الافتراضية */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  /* ---------- أدوات المجموعات والصفوف ---------- */
  function addGroup() {
    const id = crypto.randomUUID();
    setGroups((g) => [...g, { id, type: "text", name: "خيار", values: [] }]);
    setRowsByGroup((m) => ({ ...m, [id]: [] }));
  }

  // ✅ حذف مجموعة (ينادي الراوت الصحيح + تحديث الحالة)
  async function removeGroup(groupId: string) {
    try {
      const res = await fetch(
        `/api/admin/products/${product.id}/options/group/${groupId}`,
        { method: "DELETE" }
      );
      if (!res.ok) await res.json().catch(() => ({}));
    } catch {}
    // حذف محلي دائمًا + سيُطبَّق نهائيًا عند الحفظ (DELETE-by-omission)
    setGroups((g) => g.filter((x) => x.id !== groupId));
    setRowsByGroup((m) => {
      const c = { ...m };
      delete c[groupId];
      return c;
    });
  }

  function patchGroup(groupId: string, patch: Partial<OptionGroup>) {
    setGroups((g) => g.map((x) => (x.id === groupId ? { ...x, ...patch } : x)));
  }

  function addRow(groupId: string, label: string) {
    if (!label.trim()) return;
    const row: Row = {
      id: crypto.randomUUID(),
      label: label.trim(),
      sku: "",
      qty: 0,
      price: undefined,
    };
    setRowsByGroup((m) => ({ ...m, [groupId]: [...(m[groupId] || []), row] }));
  }

  // ✅ حذف قيمة/صف (ينادي الراوت الصحيح + تحديث الحالة)
  async function removeRow(groupId: string, rowId: string) {
    try {
      const res = await fetch(
        `/api/admin/products/${product.id}/options/value/${rowId}`,
        { method: "DELETE" }
      );
      if (!res.ok) await res.json().catch(() => ({}));
    } catch {}
    setRowsByGroup((m) => ({
      ...m,
      [groupId]: (m[groupId] || []).filter((r) => r.id !== rowId),
    }));
  }

  function patchRow(groupId: string, rowId: string, patch: Partial<Row>) {
    setRowsByGroup((m) => ({
      ...m,
      [groupId]: (m[groupId] || []).map((r) =>
        r.id === rowId ? { ...r, ...patch } : r
      ),
    }));
  }

  /* ---------- توليد المتغيرات من الصفوف (قيمة = متغير) ---------- */
  React.useEffect(() => {
    if (!enabled) {
      setVariants([]);
      return;
    }
    const allRows: Row[] = Object.values(rowsByGroup)
      .flat()
      .filter((r) => r.label.trim() !== "");
    if (allRows.length === 0) {
      setVariants([]);
      return;
    }
    setVariants((prev) => {
      const prevMap = new Map(prev.map((v) => [v.optionValueIds.join("|"), v]));
      return allRows.map((r) => {
        const old = prevMap.get(r.id);
        const id = old?.id ?? r.id;
        return {
          id,
          optionValueIds: [r.id],
          sku: r.sku ?? "",
          qty: r.qty ?? 0,
          ...(r.price != null ? { price: r.price } : {}),
        } as VariantRowWithPrice;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, JSON.stringify(rowsByGroup), combineOptions]);

  /* ---------- صلاحية الحفظ ---------- */
  const hasAnyRow = Object.values(rowsByGroup).some((rows) =>
    rows.some((r) => r.label.trim() !== "")
  );
  const qtyInvalid = Object.values(rowsByGroup).some((rows) =>
    rows.some((r) => Number.isNaN(r.qty) || r.qty < 0)
  );
  const canSave = enabled && hasAnyRow && !qtyInvalid;

  /* ---------- بناء Payload ---------- */
  function toServerPayload() {
    const groupsPayload: OptionGroup[] = groups
      .map((g) => {
        const rows = rowsByGroup[g.id] || [];
        const values = rows
          .filter((r) => r.label.trim() !== "")
          .map((r) => ({ id: r.id, label: r.label.trim() }));
        return {
          id: g.id,
          type: g.type,
          name: g.name?.trim() || "خيار",
          values,
        };
      })
      .filter((g) => (g.values?.length || 0) > 0);

    const variantsPayload: VariantRowWithPrice[] = (
      Object.values(rowsByGroup).flat() as Row[]
    )
      .filter((r) => r.label.trim() !== "")
      .map((r) => ({
        id: r.id,
        optionValueIds: [r.id],
        sku: (r.sku ?? "").trim(),
        qty: Number(r.qty ?? 0),
        ...(r.price != null ? { price: Number(r.price) } : {}),
      }));

    return { groupsPayload, variantsPayload };
  }

  /* ---------- الحفظ (PATCH) ---------- */
  async function saveAll() {
    if (!canSave) {
      alert(
        !enabled
          ? "فعّل خيارات المنتج."
          : qtyInvalid
          ? "الكمية غير صحيحة."
          : "أضف قيمة واحدة على الأقل."
      );
      return;
    }

    const { groupsPayload, variantsPayload } = toServerPayload();

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${product.id}/options`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionsEnabled: enabled,
          groups: groupsPayload,
          variants: variantsPayload,
          branchId: "3f393dae-bd42-40bb-b77e-5686180d2f25",
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        const msg =
          json?.message ||
          json?.error ||
          json?.detail ||
          `PATCH failed (${res.status})`;
        alert(`تعذّر الحفظ:\n${msg}`);
        return;
      }

      onSaved({
        optionsEnabled: enabled,
        options: groupsPayload,
        variants: variantsPayload,
      });
      onClose();
    } catch (e: any) {
      alert(`تعذّر الحفظ:\n${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  }

  /* ---------- الواجهة ---------- */
  return (
    <div className="fixed inset-0 z-[999] grid place-items-center bg-black/50 backdrop-blur-md p-4">
      <div className="w-full max-w-5xl rounded-2xl border border-white/20 bg-white/90 shadow-xl ring-1 ring-black/5">
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
              <span className="h-6 w-10 rounded-full bg-zinc-300 peer-checked:bg-teال-500 relative">
                <span className="absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-all peer-checked:left-5" />
              </span>
            </label>
          </div>

          {/* مجموعات + جداول */}
          <div className="space-y-6">
            {groups.map((g) => {
              const rows = rowsByGroup[g.id] || [];
              return (
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
                      onChange={(e) =>
                        patchGroup(g.id, { name: e.target.value })
                      }
                    />

                    <button
                      title="حذف الخيار"
                      onClick={() => removeGroup(g.id)}
                      className="grid place-items-center rounded-lg border border-rose-200 bg-white p-2 text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* جدول القيم */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-zinc-50 text-zinc-700">
                          <th className="p-2 text-right w-[28%]">القيمة</th>
                          <th className="p-2 text-right w-[30%]">
                            SKU (اختياري)
                          </th>
                          <th className="p-2 text-right w-[16%]">الكمية</th>
                          <th className="p-2 text-right w-[16%]">السعر</th>
                          <th className="p-2 w-[10%]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.id} className="border-t">
                            <td className="p-2">
                              <input
                                className="w-full rounded border border-zinc-200 px-2 py-1.5"
                                value={r.label}
                                onChange={(e) =>
                                  patchRow(g.id, r.id, {
                                    label: e.target.value,
                                  })
                                }
                                placeholder="مثال: 50"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                className="w-full rounded border border-zinc-200 px-2 py-1.5"
                                value={r.sku ?? ""}
                                onChange={(e) =>
                                  patchRow(g.id, r.id, { sku: e.target.value })
                                }
                                placeholder="SKU اختياري"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                inputMode="numeric"
                                className="w-28 rounded border border-zinc-200 px-2 py-1.5"
                                value={String(r.qty ?? 0)}
                                onChange={(e) =>
                                  patchRow(g.id, r.id, {
                                    qty:
                                      e.target.value === ""
                                        ? 0
                                        : +e.target.value,
                                  })
                                }
                                placeholder="0"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                inputMode="numeric"
                                className="w-28 rounded border border-zinc-200 px-2 py-1.5"
                                value={r.price != null ? String(r.price) : ""}
                                onChange={(e) =>
                                  patchRow(g.id, r.id, {
                                    price:
                                      e.target.value === ""
                                        ? undefined
                                        : +e.target.value,
                                  })
                                }
                                placeholder="0.00"
                              />
                            </td>
                            <td className="p-2 text-left">
                              <button
                                className="rounded border border-rose-300 px-3 py-1.5 text-rose-700 hover:bg-rose-50"
                                onClick={() => removeRow(g.id, r.id)}
                                type="button"
                                title="حذف القيمة"
                              >
                                <Trash2 className="inline h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {rows.length === 0 && (
                          <tr>
                            <td className="p-4 text-zinc-400" colSpan={5}>
                              لا توجد قيم بعد — أضف قيمة جديدة أدناه.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* إضافة قيمة جديدة */}
                  <AddRowInline onAdd={(label) => addRow(g.id, label)} />
                </div>
              );
            })}
          </div>

          {/* زر إضافة مجموعة/خيار جديد */}
          <div className="mt-4">
            <button
              type="button"
              onClick={addGroup}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                className="-ms-0.5"
              >
                <path
                  d="M12 5v14m7-7H5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              إضافة خيار جديد
            </button>
          </div>

          {/* أزرار */}
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

/* إضافة صف سريع */
function AddRowInline({ onAdd }: { onAdd: (label: string) => void }) {
  const [val, setVal] = React.useState("");
  return (
    <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
      <input
        className="rounded border border-zinc-200 bg-white px-3 py-2 text-sm"
        placeholder="إضافة قيمة جديدة (مثال: 50)"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && val.trim()) {
            onAdd(val.trim());
            setVal("");
          }
        }}
      />
      <button
        className="inline-flex items-center justify-center gap-1 rounded border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
        onClick={() => {
          if (!val.trim()) return;
          onAdd(val.trim());
          setVal("");
        }}
        type="button"
      >
        <Plus className="h-4 w-4" />
        إضافة
      </button>
    </div>
  );
}
