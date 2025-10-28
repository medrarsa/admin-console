"use client";
import { useEffect, useState } from "react";

export type VariantRow = {
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

export function useVariants(productId: string) {
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
      if (!r.ok) throw new Error(j?.error || "Failed to load variants");
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

  return { rows, loading, error, refresh, setRows };
}
