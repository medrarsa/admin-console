// src/app/admin/products/ProductsClient.tsx
"use client";

import * as React from "react";
import dynamic from "next/dynamic";

/* ===================== Types coming from server ===================== */
export type Product = {
  id: string;
  name: string;
  status: "active" | "draft" | "archived" | "hidden" | "sale" | "out";
  pinned?: boolean;
  imageUrl?: string;
  price?: number;
  salePrice?: number;
  qty?: number;

  /* ملخصات الأسعار/الكميات القادمة من الـ API (إن وُجدت) */
  variants_price_min: number | null;
  variants_price_max: number | null;
  variants_price_label: string | null;
  variants_total_qty: number;
  base_price_fallback: number | null;
  base_qty_fallback: number;

  tags?: string[];
  localCategory?: string | null;

  // product data modal fields
  costPrice?: number;
  discountEnd?: string;
  sku?: string;
  brand?: string | null;
  shortTitle?: string;
  years?: string;
  descriptionHtml?: string;
  seoTitleTpl?: string;
  seoSlugTpl?: string;
  seoDescTpl?: string;

  // variants/options (تُدار عبر المودال)
  optionsEnabled?: boolean;
  options?: OptionGroup[];
  variants?: VariantRow[];

  // علامة محلية لمعرفة أن المنتج جديد ولم يُحفظ في DB بعد
  _isNew?: boolean;
};

export type OptionGroupType = "text" | "color" | "image";
export type OptionValue = {
  id: string;
  label: string;
  colorHex?: string;
  imageUrl?: string;
};
export type OptionGroup = {
  id: string;
  type: OptionGroupType;
  name: string;
  values: OptionValue[];
};
export type VariantRow = {
  id: string;
  optionValueIds: string[];
  sku?: string;
  qty?: number;
};

/* ===================== Helpers ===================== */
const cx = (...p: Array<string | false | undefined>) =>
  p.filter(Boolean).join(" ");

function LoadingOverlay({
  show,
  label = "جارٍ الحفظ...",
}: {
  show: boolean;
  label?: string;
}) {
  if (!show) return null;
  return (
    <div className="pointer-events-auto fixed inset-0 z-[9999] grid place-items-center bg-black/30">
      <div className="rounded-2xl bg-white px-6 py-4 shadow-xl ring-1 ring-zinc-200">
        <div className="flex items-center gap-3">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
          <span className="text-sm font-medium">{label}</span>
        </div>
      </div>
    </div>
  );
}

/* ===================== API helpers ===================== */
async function patchProduct(productId: string, payload: Record<string, any>) {
  const res = await fetch(`/api/admin/products/${productId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok || !json?.success) {
    console.error("PATCH /products/:id failed", { status: res.status, json });
    throw new Error(json?.error || `فشل الحفظ (PATCH ${res.status})`);
  }
  return json.data as Product;
}

async function createProduct(payload: Record<string, any>) {
  const res = await fetch(`/api/admin/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok || !json?.success) {
    console.error("POST /products failed", { status: res.status, json });
    throw new Error(json?.error || `فشل الإنشاء (POST ${res.status})`);
  }
  return json.data as Product;
}

async function fetchProductDetails(productId: string) {
  const res = await fetch(`/api/admin/products/${productId}`, {
    method: "GET",
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || `فشل الجلب (GET ${res.status})`);
  }
  return json.data as any;
}

/* نبني حمولة الإنشاء بحيث يكوّن Variant + Price + Inventory من أول حفظ */
function buildCreatePayload(p: Product) {
  return {
    name: p.name?.trim() || "منتج جديد",
    tags: p.tags ?? [],
    images: p.imageUrl ? [{ url: p.imageUrl, is_primary: true }] : [],
    channels: ["web", "app"],
    skus: [
      {
        price: typeof p.price === "number" ? p.price : 0,
        currency: "SAR",
        unlimited_quantity: false,
        qty_on_hand: typeof p.qty === "number" ? p.qty : 0,
      },
    ],
  };
}

async function fetchCards(cursor?: string | null, limit = 24) {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  if (cursor) qs.set("cursor", cursor);
  const res = await fetch(`/api/admin/products?${qs.toString()}`, {
    cache: "no-store",
  });
  const j = await res.json();
  if (!res.ok || !j?.success)
    throw new Error(j?.error || `Fetch failed ${res.status}`);
  return j.data as { items: Product[]; nextCursor: string | null };
}

/* ===================== Dynamic children ===================== */
type SallaCardProps = {
  p: Product;
  onChange: (patch: Partial<Product>) => void;
  onDelete: () => void;
  onOpenEdit: () => void;
  onOpenOptions: () => void;
  onOpenImages: () => void;
  onSaveCard: () => Promise<void>;
};

const SallaProductCard = dynamic<SallaCardProps>(
  () => import("./_components/SallaProductCard"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[430px] rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
        <div className="mb-2 h-48 w-full animate-pulse rounded-xl bg-zinc-100" />
        <div className="mb-2 h-8 w-full animate-pulse rounded bg-zinc-100" />
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-100" />
      </div>
    ),
  }
);

type DialogProps = {
  product: Product;
  onClose: () => void;
  onSaved: (patch: Partial<Product>) => void;
};

const ProductDataDialog = dynamic<DialogProps>(
  () => import("./_dialogs/ProductDataDialog"),
  { ssr: false, loading: () => <ModalSkeleton title="بيانات المنتج" /> }
);

const ProductImagesDialog = dynamic<DialogProps>(
  () => import("./_dialogs/ProductImagesDialog"),
  { ssr: false, loading: () => <ModalSkeleton title="إدارة الصور" /> }
);

const OptionsQuantityDialog = dynamic<DialogProps>(
  () => import("./_dialogs/OptionsQuantityDialog"),
  { ssr: false, loading: () => <ModalSkeleton title="الخيارات والكمية" /> }
);

function ModalSkeleton({ title }: { title: string }) {
  return (
    <div className="fixed inset-0 z-[999] grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="m-0 text-base font-bold">{title}</h3>
          <div className="h-4 w-16 animate-pulse rounded bg-zinc-200" />
        </div>
        <div className="space-y-3">
          <div className="h-8 w-full animate-pulse rounded bg-zinc-100" />
          <div className="h-8 w-full animate-pulse rounded bg-zinc-100" />
          <div className="h-40 w-full animate-pulse rounded bg-zinc-100" />
        </div>
      </div>
    </div>
  );
}

/* ===================== Page (client) ===================== */
export default function ProductsClient({
  initialRows,
}: {
  initialRows: Product[];
}) {
  const [rows, setRows] = React.useState<Product[]>(initialRows);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // modals
  const [openEdit, setOpenEdit] = React.useState<null | Product>(null);
  const [openOptions, setOpenOptions] = React.useState<null | Product>(null);
  const [openImages, setOpenImages] = React.useState<null | Product>(null);

  // التحميل الأول من مسار القائمة الجاهز (لو initialRows ناقص فيها الحقول)
  React.useEffect(() => {
    (async () => {
      const need =
        !rows?.length ||
        typeof rows[0]?.variants_price_min === "undefined" ||
        typeof rows[0]?.base_price_fallback === "undefined";
      if (need) {
        const { items, nextCursor } = await fetchCards(null, 24);
        setRows(items);
        setCursor(nextCursor);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = React.useMemo(
    () =>
      rows.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase())),
    [rows, q]
  );

  const patchLocal = (id: string, patch: Partial<Product>) => {
    setRows((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  async function withBusy<T>(fn: () => Promise<T> | T) {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setTimeout(() => setBusy(false), 40);
    }
  }

  // تحميل المزيد (زر)
  const loadMore = React.useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { items, nextCursor } = await fetchCards(cursor, 24);
      setRows((r) => [...r, ...items]);
      setCursor(nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  return (
    <div dir="rtl" className="relative isolate mx-auto max-w-[1280px] p-4">
      {/* Overlay لودينغ أثناء الحفظ */}
      <LoadingOverlay show={busy} label="جارٍ الحفظ..." />

      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
        <input
          className="min-w-64 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
          placeholder="ابحث باسم المنتج…"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
        />
        <button
          onClick={() =>
            setRows((r) => [
              {
                id: `temp-${crypto.randomUUID()}`,
                _isNew: true,
                name: "منتج جديد",
                status: "draft",
                qty: 0,
                price: 0,
                tags: [],
                localCategory: null,
                optionsEnabled: false,
                options: [],
                variants: [],
                variants_price_min: null,
                variants_price_max: null,
                variants_price_label: null,
                variants_total_qty: 0,
                base_price_fallback: null,
                base_qty_fallback: 0,
              },
              ...r,
            ])
          }
          className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-teal-700"
        >
          منتج جديد
        </button>
      </div>

      {/* Grid */}
      <div
        className={cx(
          "isolate grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        )}
      >
        {filtered.map((p) => (
          <SallaProductCard
            key={p.id}
            p={p}
            onChange={(patch: Partial<Product>) => patchLocal(p.id, patch)}
            onDelete={() => setRows((r) => r.filter((x) => x.id !== p.id))}
            onOpenEdit={() => setOpenEdit(p)}
            onOpenOptions={() => setOpenOptions(p)}
            onOpenImages={() => setOpenImages(p)}
            onSaveCard={async () => {
              try {
                await withBusy(async () => {
                  if (p._isNew) {
                    // أول حفظ = إنشاء فعلي بمتغير وسعر وكمية
                    const created = await createProduct(buildCreatePayload(p));
                    const full = await fetchProductDetails((created as any).id);
                    setRows((rows) =>
                      rows.map((x) =>
                        x.id === p.id
                          ? {
                              ...x,
                              id: (full as any).id,
                              _isNew: false,
                              variants_price_min:
                                full?.variants_price_min ?? null,
                              variants_price_max:
                                full?.variants_price_max ?? null,
                              variants_price_label:
                                full?.variants_price_label ?? null,
                              variants_total_qty: full?.variants_total_qty ?? 0,
                              base_price_fallback:
                                full?.base_price_fallback ?? null,
                              base_qty_fallback: full?.base_qty_fallback ?? 0,
                              imageUrl:
                                x.imageUrl ??
                                ((Array.isArray(full?.images) &&
                                  full.images[0]?.url) ||
                                  null),
                            }
                          : x
                      )
                    );
                  } else {
                    // حفظ تعديلات لاحقة
                    const payload: Record<string, any> = {
                      name: p.name,
                      tags: p.tags ?? [],
                    };
                    if (typeof p.price === "number") payload.price = p.price;
                    if (typeof p.qty === "number") payload.qty = p.qty;

                    await patchProduct(p.id, payload);

                    const full = await fetchProductDetails(p.id);
                    setRows((rows) =>
                      rows.map((x) =>
                        x.id === p.id
                          ? {
                              ...x,
                              variants_price_min:
                                full?.variants_price_min ?? null,
                              variants_price_max:
                                full?.variants_price_max ?? null,
                              variants_price_label:
                                full?.variants_price_label ?? null,
                              variants_total_qty: full?.variants_total_qty ?? 0,
                              base_price_fallback:
                                full?.base_price_fallback ?? null,
                              base_qty_fallback: full?.base_qty_fallback ?? 0,
                              imageUrl:
                                x.imageUrl ??
                                ((Array.isArray(full?.images) &&
                                  full.images[0]?.url) ||
                                  null),
                            }
                          : x
                      )
                    );
                  }
                });
                alert("✅ تم الحفظ بنجاح");
              } catch (err: any) {
                console.error("Save product failed:", err);
                alert(`❌ فشل الحفظ: ${err?.message || err}`);
              }
            }}
          />
        ))}
      </div>

      {/* Load more */}
      <div className="mt-4 flex justify-center">
        {cursor && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loadingMore ? "جاري التحميل…" : "تحميل المزيد"}
          </button>
        )}
      </div>

      {/* Modals */}
      {openEdit && (
        <ProductDataDialog
          product={openEdit}
          onSaved={(patch) => patchLocal(openEdit.id, patch)}
          onClose={() => setOpenEdit(null)}
        />
      )}

      {openImages && (
        <ProductImagesDialog
          product={openImages}
          onSaved={(patch) => patchLocal(openImages.id, patch)}
          onClose={() => setOpenImages(null)}
        />
      )}

      {openOptions && (
        <OptionsQuantityDialog
          product={openOptions}
          onSaved={(patch) => patchLocal(openOptions.id, patch)}
          onClose={() => setOpenOptions(null)}
        />
      )}
    </div>
  );
}
