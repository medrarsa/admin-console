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

  tags?: string[];
  localCategory?: string | null;

  // product data modal fields (أرسل فقط ما عندك في DB)
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
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // modals
  const [openEdit, setOpenEdit] = React.useState<null | Product>(null);
  const [openOptions, setOpenOptions] = React.useState<null | Product>(null);
  const [openImages, setOpenImages] = React.useState<null | Product>(null);

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
                id: `temp-${crypto.randomUUID()}`, // مؤقت
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
                    // ثبت الـid الحقيقي ولا تمسح القيم المحلية
                    setRows((rows) =>
                      rows.map((x) =>
                        x.id === p.id ? { ...x, id: (created as any).id, _isNew: false } : x
                      )
                    );
                  } else {
                    // حفظ تعديلات لاحقة
                    const payload = {
                      name: p.name,
                      price: p.price ?? null,
                      qty: p.qty ?? null,
                      tags: p.tags ?? [],
                      // ملاحظة: راوت PATCH عندك لازم يدير ترجمة price/qty إلى variant/price/inventory إن رغبت
                    };
                    await patchProduct(p.id, payload);
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
