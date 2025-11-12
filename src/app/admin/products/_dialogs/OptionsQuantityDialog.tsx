// src/app/admin/products/_dialogs/OptionsQuantityDialog.tsx
"use client";

import * as React from "react";
import { Trash2, Plus } from "lucide-react";
import type { Product, OptionGroup, VariantRow } from "../ProductsClient";

/* توسيع نوع المتغير محليًا لدعم السعر والخصم (بدون تواريخ) */
type VariantRowWithPrice = VariantRow & {
  price?: number | null;
  salePrice?: number | null;
};

/* صف جدول القيم داخل كل مجموعة */
type Row = {
  id: string;
  label: string;
  sku?: string;
  qty: number;
  price?: number;
  salePrice?: number;
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

            rows.push({
              id: val.id,
              label: val.label ?? "",
              sku: v2?.sku ?? "",
              qty: Number(v2?.qty ?? 0),
              price:
                v2 && typeof (v2 as any)?.price === "number"
                  ? Number((v2 as any).price)
                  : undefined,
              salePrice:
                v2 && typeof (v2 as any)?.salePrice === "number"
                  ? Number((v2 as any).salePrice)
                  : undefined,
            });
          }
          map[g.id] = rows;
        }

        if (!alive) return;

        // فعّل الخيارات تلقائيًا إذا وجدنا أي صفوف
        const hasRows = nextGroups.some((gg) => (map[gg.id]?.length || 0) > 0);
        setEnabled(
          typeof json.optionsEnabled === "boolean"
            ? json.optionsEnabled
            : hasRows
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
    setEnabled(true);
  }

  // حذف مجموعة (استدعاء الراوت + إزالة محلية)
  async function removeGroup(groupId: string) {
    try {
      const res = await fetch(
        `/api/admin/products/${product.id}/options/group/${groupId}`,
        { method: "DELETE" }
      );
      if (!res.ok) await res.json().catch(() => ({}));
    } catch {}
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
      salePrice: undefined,
    };
    setRowsByGroup((m) => ({ ...m, [groupId]: [...(m[groupId] || []), row] }));
    setEnabled(true);
  }

  // حذف قيمة/صف (استدعاء الراوت + إزالة محلية)
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
    const allRows: Row[] = Object.values(rowsByGroup)
      .flat()
      .filter((r) => r.label.trim() !== "");
    if (!enabled && allRows.length === 0) {
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
          ...(typeof r.price === "number" ? { price: r.price } : {}),
          ...(typeof r.salePrice === "number"
            ? { salePrice: r.salePrice }
            : {}),
        } as VariantRowWithPrice;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, JSON.stringify(rowsByGroup)]);

  /* ---------- صلاحية الحفظ ---------- */
  const hasAnyRow = Object.values(rowsByGroup).some((rows) =>
    rows.some((r) => r.label.trim() !== "")
  );
  const qtyInvalid = Object.values(rowsByGroup).some((rows) =>
    rows.some((r) => Number.isNaN(r.qty) || r.qty < 0)
  );

  // السعر والخصم اختياريان؛ نمنع فقط خصم بلا سعر أو خصم ≤ 0 أو خصم ≥ السعر
  const saleInvalid = Object.values(rowsByGroup).some((rows) =>
    rows.some((r) => {
      if (r.salePrice == null) return false;
      if (r.price == null) return true;
      if (r.salePrice <= 0) return true;
      if (r.salePrice >= r.price) return true;
      return false;
    })
  );

  const effectiveEnabled =
    enabled ||
    Object.values(rowsByGroup).some((rows) =>
      rows.some((r) => r.label.trim() !== "")
    );
  const canSave = effectiveEnabled && hasAnyRow && !qtyInvalid && !saleInvalid;

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
        ...(typeof r.price === "number" ? { price: Number(r.price) } : {}),
        ...(typeof r.salePrice === "number"
          ? { salePrice: Number(r.salePrice) }
          : {}),
      }));

    return { groupsPayload, variantsPayload };
  }

  /* ---------- الحفظ (PATCH) ---------- */
  async function saveAll() {
    if (!canSave) {
      alert(
        qtyInvalid
          ? "الكمية غير صحيحة."
          : saleInvalid
          ? "تحقق من سعر الخصم: لا يجوز إدخال خصم بلا سعر أصلي، أو خصم ≤ 0، أو خصم ≥ السعر."
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
          optionsEnabled: true,
          groups: groupsPayload,
          variants: variantsPayload,
          branchId: "3f393dae-bd42-40bb-b77e-5686180d2f25",
        }),
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {}

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
        optionsEnabled: true,
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
            إدارة الكميات والأسعار —{" "}
            <span className="text-teal-700">{product.name}</span>
          </h3>

          <div className="flex items-center gap-2">
            {/* زر إنشاء مجموعة ثانية/جديدة */}
            <button
              onClick={addGroup}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
              type="button"
              title="إضافة مجموعة"
            >
              <Plus className="h-4 w-4" />
              إضافة مجموعة
            </button>

            <button
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
              onClick={onClose}
              type="button"
            >
              إغلاق
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[80vh] overflow-y-auto px-5 py-4">
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
                      placeholder="مسمى الخيار (مثال: مقاسات / ألوان)"
                      value={g.name}
                      onChange={(e) =>
                        patchGroup(g.id, { name: e.target.value })
                      }
                    />

                    <button
                      title="حذف الخيار"
                      onClick={() => removeGroup(g.id)}
                      className="grid place-items-center rounded-lg border border-rose-200 bg-white p-2 text-rose-700 hover:bg-rose-50"
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* جدول القيم */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-zinc-50 text-zinc-700">
                          <th className="p-2 text-right w-[24%]">القيمة</th>
                          <th className="p-2 text-right w-[24%]">
                            SKU (اختياري)
                          </th>
                          <th className="p-2 text-right w-[16%]">الكمية</th>
                          <th className="p-2 text-right w-[18%]">السعر</th>
                          <th className="p-2 text-right w-[18%]">سعر الخصم</th>
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
                                placeholder="مثال: 50 أو أسود"
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
                                className="w-24 rounded border border-zinc-200 px-2 py-1.5"
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
                            <td className="p-2">
                              <input
                                inputMode="numeric"
                                className="w-28 rounded border border-zinc-200 px-2 py-1.5"
                                value={
                                  r.salePrice != null ? String(r.salePrice) : ""
                                }
                                onChange={(e) =>
                                  patchRow(g.id, r.id, {
                                    salePrice:
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
                            <td className="p-4 text-zinc-400" colSpan={6}>
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
        placeholder="إضافة قيمة جديدة (مثال: 50 أو أسود)"
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
