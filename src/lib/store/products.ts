// src/lib/store/products.ts

/* ========= قوائم المنتجات (شبكات/تصنيفات) ========= */
export type ProductListItem = {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  price: number;              // أقل سعر أساس (أو 0 إن لم يتوفر)
  sale_price: number | null;  // أقل سعر بعد خصم إن وجد
  // حقول اختيارية تدعم البطاقة
  brand_name?: string | null;
  ends_at?: string | null;     // ISO — انتهاء الخصم (للعداد)
  starts_from?: boolean;       // لعرض "يبدأ من"
};

export async function fetchProducts(
  params: {
    q?: string;
    root?: string;
    sub?: string;
    seg?: string;
    page?: number;
    size?: number;
  } = {}
): Promise<{
  data: ProductListItem[];
  total: number;
  page: number;
  size: number;
}> {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null) as any
  );
  const res = await fetch(`/api/store/products?${qs.toString()}`, {
    cache: "no-store",
  });
  const json = await res.json();
  if (!json?.success) {
    throw new Error(json?.error || "failed to load products");
  }
  // نضمن تطبيع القيم الاختيارية لأمان الأنواع في الواجهة
  const normalized = (json.data as ProductListItem[]).map((p) => ({
    ...p,
    brand_name: p.brand_name ?? null,
    ends_at: p.ends_at ?? null,
    starts_from: p.starts_from ?? false,
  }));
  return {
    data: normalized,
    total: json.total ?? normalized.length,
    page: json.page ?? 1,
    size: json.size ?? normalized.length,
  };
}

/* ========= تفاصيل المنتج (صفحة المنتج) ========= */
export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  brand_name: string | null;
  descriptionHtml: string | null;
  image: string | null;        // الصورة الأساسية
  gallery: string[];           // بقية الصور
  price: number | null;        // أقل سعر أساس على مستوى المنتج
  sale_price: number | null;   // أقل سعر بعد خصم إن وجد
  ends_at: string | null;      // ISO — انتهاء الخصم
  variants: Array<{
    id: string;
    sku?: string | null;
    attrs?: Record<string, string> | null; // {color:'Black', size:'L'} مثلًا
    price: number | null;
    sale_price: number | null;
    ends_at: string | null;
  }>;
};

export async function fetchProductDetail(
  slug: string
): Promise<ProductDetail | null> {
  const res = await fetch(`/api/store/product/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
  const json = await res.json();
  if (!json?.success) return null;

  // تطبيع بسيط
  const d = json.data as ProductDetail;
  return {
    ...d,
    brand_name: d.brand_name ?? null,
    descriptionHtml: d.descriptionHtml ?? null,
    image: d.image ?? null,
    gallery: Array.isArray(d.gallery) ? d.gallery : [],
    price: d.price ?? 0,
    sale_price: d.sale_price ?? null,
    ends_at: d.ends_at ?? null,
    variants: (d.variants ?? []).map((v) => ({
      ...v,
      sku: v.sku ?? null,
      attrs: v.attrs ?? null,
      price: v.price ?? null,
      sale_price: v.sale_price ?? null,
      ends_at: v.ends_at ?? null,
    })),
  };
}
