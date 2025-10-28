"use client";
import { useEffect, useState } from "react";

/* ===== Types ===== */
type VariantRow = {
  variant_id: string;
  sku: string;
  status: "active" | "draft" | "archived";
  unlimited_quantity: boolean;
  weight: number | null;
  weight_type: "kg" | "g" | "lb" | "oz" | null;
  price: number;
  sale_price: number | null;
  currency: string;
  ends_at: string | null;
  qty_on_hand: number;
  qty_reserved: number;
};

/* ===== Hook: fetch variants ===== */
function useVariants(productId: string) {
  const [rows, setRows] = useState<VariantRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setLoading(true);
      setError(null);
      const r = await fetch(`/api/admin/products/${productId}/variants`, {
        cache: "no-store",
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "فشل جلب SKUs");
      setRows(j.data || []);
    } catch (e: any) {
      setError(e?.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (productId) refresh();
  }, [productId]);
  return { rows, loading, error, refresh };
}

/* ===== Variants Tab ===== */
export default function VariantsTab({ productId }: { productId: string }) {
  const { rows, loading, error, refresh } = useVariants(productId);
  const [saving, setSaving] = useState<string | null>(null);
  const [txOpen, setTxOpen] = useState<null | { variantId: string }>(null);
  const [firstBranchId, setFirstBranchId] = useState<string>("");

  // احضر أول فرع (بسيط)
  useEffect(() => {
    fetch("/api/admin/branches/first")
      .then((r) => r.json())
      .then((j) => setFirstBranchId(j?.id || ""));
  }, []);

  async function savePrice(
    vId: string,
    payload: {
      price: number;
      sale_price?: number | null;
      ends_at?: string | null;
    }
  ) {
    try {
      setSaving(vId);
      const r = await fetch(`/api/admin/variants/${vId}/price`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "فشل حفظ السعر");
      await refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(null);
    }
  }

  async function submitTx(body: {
    variant_id: string;
    branch_id: string;
    kind: "in" | "out" | "adjust" | "return";
    qty: number;
    reference?: string;
  }) {
    try {
      const r = await fetch("/api/admin/inventory/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "فشل إضافة المعاملة");
      await refresh();
      setTxOpen(null);
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">الخيارات والكمية</h3>
        <button onClick={refresh} className="px-3 py-1.5 rounded-lg border">
          تحديث
        </button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}
      {loading && <div className="text-sm opacity-70">تحميل…</div>}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-start">SKU</th>
              <th className="p-3 text-start">السعر</th>
              <th className="p-3 text-start">سعر العرض</th>
              <th className="p-3 text-start">ينتهي</th>
              <th className="p-3 text-start">متوفر</th>
              <th className="p-3 text-start">محجوز</th>
              <th className="p-3 text-start">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.variant_id} className="border-t">
                <td className="p-3 font-mono">{r.sku}</td>

                <td className="p-3">
                  <input
                    defaultValue={r.price}
                    type="number"
                    step="0.01"
                    className="w-28 border rounded px-2 py-1"
                    onBlur={(e) => {
                      const v = parseFloat(e.currentTarget.value || "0");
                      if (!Number.isFinite(v) || v === r.price) return;
                      savePrice(r.variant_id, {
                        price: v,
                        sale_price: r.sale_price,
                        ends_at: r.ends_at,
                      });
                    }}
                    disabled={saving === r.variant_id}
                  />
                </td>

                <td className="p-3">
                  <input
                    defaultValue={r.sale_price ?? ""}
                    placeholder="—"
                    type="number"
                    step="0.01"
                    className="w-28 border rounded px-2 py-1"
                    onBlur={(e) => {
                      const sp =
                        e.currentTarget.value === ""
                          ? null
                          : parseFloat(e.currentTarget.value);
                      if (sp === r.sale_price) return;
                      savePrice(r.variant_id, {
                        price: r.price,
                        sale_price: sp,
                        ends_at: r.ends_at,
                      });
                    }}
                    disabled={saving === r.variant_id}
                  />
                </td>

                <td className="p-3">
                  <input
                    defaultValue={r.ends_at?.slice(0, 10) ?? ""}
                    type="date"
                    className="border rounded px-2 py-1"
                    onBlur={(e) => {
                      const end = e.currentTarget.value
                        ? e.currentTarget.value
                        : null;
                      if (end === (r.ends_at?.slice(0, 10) ?? null)) return;
                      savePrice(r.variant_id, {
                        price: r.price,
                        sale_price: r.sale_price,
                        ends_at: end,
                      });
                    }}
                    disabled={saving === r.variant_id}
                  />
                </td>

                <td className="p-3">
                  {r.unlimited_quantity ? "∞" : r.qty_on_hand}
                </td>
                <td className="p-3">{r.qty_reserved}</td>
                <td className="p-3">
                  <button
                    onClick={() => setTxOpen({ variantId: r.variant_id })}
                    className="px-3 py-1.5 rounded bg-black text-white"
                  >
                    + معاملة
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td className="p-4 text-center text-gray-500" colSpan={7}>
                  لا توجد SKUs لهذا المنتج.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {txOpen && firstBranchId && (
        <TxModal
          variantId={txOpen.variantId}
          branchId={firstBranchId}
          onClose={() => setTxOpen(null)}
          onSubmit={(b) => submitTx(b)}
        />
      )}
    </div>
  );
}

/* ===== Modal: إضافة معاملة ===== */
function TxModal({
  variantId,
  branchId,
  onClose,
  onSubmit,
}: {
  variantId: string;
  branchId: string;
  onClose: () => void;
  onSubmit: (body: {
    variant_id: string;
    branch_id: string;
    kind: "in" | "out" | "adjust" | "return";
    qty: number;
    reference?: string;
  }) => void;
}) {
  const [kind, setKind] = useState<"in" | "out" | "adjust" | "return">("in");
  const [qty, setQty] = useState<number>(1);
  const [ref, setRef] = useState<string>("");

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
        <div className="text-lg font-bold">إضافة معاملة مخزون</div>
        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm">النوع</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
              className="border rounded px-2 py-1"
            >
              <option value="in">in (إدخال)</option>
              <option value="out">out (إخراج)</option>
              <option value="adjust">adjust (تعديل)</option>
              <option value="return">return (مرتجع)</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm">الكمية</span>
            <input
              type="number"
              value={qty}
              min={1}
              onChange={(e) => setQty(parseInt(e.target.value || "1"))}
              className="border rounded px-2 py-1"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm">مرجع (اختياري)</span>
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              className="border rounded px-2 py-1"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded border">
            إلغاء
          </button>
          <button
            onClick={() =>
              onSubmit({
                variant_id: variantId,
                branch_id: branchId,
                kind,
                qty,
                reference: ref || undefined,
              })
            }
            className="px-3 py-1.5 rounded bg-black text-white"
          >
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
}
