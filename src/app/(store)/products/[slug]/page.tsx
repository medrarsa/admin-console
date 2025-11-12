// src/app/products/[slug]/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/* Server components */
import ImageGallery from "@/app/(store-components)/products/ImageGallery";
import {
  ViewersNow,
  StockLeft,
} from "@/app/(store-components)/products/EngagementBars";
import OptionsPicker from "@/app/(store-components)/products/OptionsPicker";

/* Client components */
import DealCountdownClient from "@/app/(store-components)/products/DealCountdownClient";
import SizeGuideButton from "@/app/(store-components)/products/SizeGuideButton";
import ProductAddBar from "@/app/(store-components)/products/ProductAddBar";
import PriceDisplayClient from "@/app/(store-components)/products/PriceDisplayClient";
import FreeShippingBarClient from "@/app/(store-components)/products/FreeShippingBarClient";
/* جسر حالة "لا توجد مجموعات" */
import NoOptionsPriceClient from "@/app/(store-components)/products/NoOptionsPriceClient";
/* شارة المخزون الحي (تقرأ available_qty من الحدث) */
import StockBadgeClient from "@/app/(store-components)/products/StockBadgeClient";

/* ===== Helpers ===== */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
function getBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NEXT_PUBLIC_BASE_URL)
    return process.env.NEXT_PUBLIC_BASE_URL!;
  return "http://localhost:3000";
}

/* ===== API types ===== */
type PriceCanonical = {
  list: number;
  sale: number | null;
  label: { kind: "sale" | "single" | "range"; text: string };
};
type ApiValue = {
  id: string;
  label?: string;
  name?: string;
  display_value?: string | null;
  image_url?: string | null;

  // ممكن تجي بهذه الأسماء
  extra_price?: number | string | null; // legacy
  extra_sale_price?: number | string | null; // legacy
  list_price?: number | string | null; // route الجديد إن كان مفعّل
  sale_price?: number | string | null; // route الجديد إن كان مفعّل
  display_price?: number | string | null; // اختياري
  qty_total?: number | string | null; // كمية هذه القيمة

  sort_order?: number | null;
};
type ApiGroup = {
  id: string;
  name: string;
  display_type?: "text" | "image" | "color";
  kind?: "choice" | "addon";
  type?: "radio" | "checkbox";
  required?: boolean;
  values: ApiValue[];
};
type ApiVariant = {
  id: string;
  sku?: string | null;
  status: string;
  value_ids: string[];
  price?: number | null;
  sale_price?: number | null;
  ends_at?: string | null;
  qty_available?: number | null; // 👈 لازم من الراوت
};
type ApiProduct = {
  id: string;
  slug: string;
  name: string;
  brand_name?: string | null;
  main_sku?: string | null;
  image?: string | null;
  images?: string[];
  ends_at?: string | null;
  price_canonical: PriceCanonical;
  option_groups: ApiGroup[];
  variants: ApiVariant[];
};

/* ===== Picker types ===== */
type PickerValue = {
  id: string;
  label: string;
  value_code?: string | null;
  extra_price?: number | null;
  extra_sale_price?: number | null;
  qty_total?: number | null; // نمرّرها كما هي
  sort_order?: number | null;
};
type PickerVariant = {
  id: string;
  sku?: string | null;
  status: string;
  value_ids: string[];
  price?: number | null;
  sale_price?: number | null;
  ends_at?: string | null;
  qty_available?: number | null; // 👈 مهم لحالة بدون مجموعات
};
type PickerGroup = {
  id: string;
  name: string;
  kind: "choice" | "addon";
  display_type?: string | null;
  values: PickerValue[];
};
type PickerProductData = {
  id: string;
  main_variant_id: string | null;
  base_price_fallback: number | null;
  base_qty_fallback: number;
  variants_min_price: number | null;
  variants_max_price: number | null;
  variants_total_qty: number;
  option_groups: PickerGroup[];
  variants: PickerVariant[];
};

/* ===== Converter ===== */
const toNum = (x: unknown): number | null => {
  if (x == null) return null;
  const n = typeof x === "string" ? Number(x) : (x as number);
  return Number.isFinite(n) ? (n as number) : null;
};

function toPickerProduct(api: ApiProduct): PickerProductData {
  const option_groups: PickerValue[][] = (api.option_groups ?? []).map((g) =>
    (g.values ?? []).map((v) => ({
      id: String(v.id),
      label: String(v.label ?? v.name ?? ""),
      value_code: v.display_value ?? null,
      extra_price: toNum((v as any).list_price) ?? toNum(v.extra_price),
      extra_sale_price:
        toNum((v as any).sale_price) ?? toNum(v.extra_sale_price),
      qty_total: toNum((v as any).qty_total),
      sort_order: v.sort_order ?? 0,
    }))
  );

  const pickerGroups: PickerGroup[] = (api.option_groups ?? []).map((g, i) => ({
    id: String(g.id),
    name: String(g.name ?? ""),
    kind: ((g.kind as any) ?? (g.type === "radio" ? "choice" : "addon")) as
      | "choice"
      | "addon",
    display_type: g.display_type ?? null,
    values: option_groups[i] ?? [],
  }));

  const variants: PickerVariant[] = (api.variants ?? []).map((v) => ({
    id: String(v.id),
    sku: v.sku ?? null,
    status: v.status,
    value_ids: Array.isArray(v.value_ids) ? v.value_ids.map(String) : [],
    price: typeof v.price === "number" ? v.price : null,
    sale_price: typeof v.sale_price === "number" ? v.sale_price : null,
    ends_at: v.ends_at ?? null,
    qty_available: typeof v.qty_available === "number" ? v.qty_available : null, // ✅
  }));

  return {
    id: String(api.id),
    main_variant_id: variants[0]?.id ?? null,
    base_price_fallback:
      typeof api.price_canonical?.list === "number"
        ? api.price_canonical.list
        : null,
    base_qty_fallback: 1,
    variants_min_price: null,
    variants_max_price: null,
    variants_total_qty: 0,
    option_groups: pickerGroups,
    variants,
  };
}

/* ===== Data fetch ===== */
async function fetchProduct(slug: string): Promise<ApiProduct | null> {
  const base = getBaseUrl();
  const r = await fetch(
    `${base}/api/store/products?slug=${encodeURIComponent(slug)}`,
    { cache: "no-store" }
  );
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  return j?.success ? (j.data as ApiProduct) : null;
}

/* ===== SEO ===== */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>; // ✅ Next 15: params Promise
}): Promise<Metadata> {
  const { slug: raw } = await params;         // ✅ لازم await
  const slug = decodeURIComponent(raw);
  const data = await fetchProduct(slug);
  const title = data?.name ? `${data.name} | المتجر` : "المتجر";
  const description = data?.brand_name
    ? `${data.brand_name} — ${data?.name}`
    : data?.name ?? "Product";
  const canonical = `${SITE_URL}/products/${slug}`;
  const imgs = Array.isArray(data?.images)
    ? data!.images
    : data?.image
    ? [data.image]
    : [];
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      images: imgs.length ? [{ url: imgs[0]! }] : undefined,
    },
  };
}

/* ===== Page ===== */
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>; // ✅ Next 15: params Promise
}) {
  const { slug: raw } = await params;         // ✅ لازم await
  const slug = decodeURIComponent(raw);
  const p = await fetchProduct(slug);
  if (!p) return notFound();

  const gallery = p.images?.length ? p.images : p.image ? [p.image] : [];
  const hasDeal = !!p.ends_at && new Date(p.ends_at) > new Date();
  const pickerProduct = toPickerProduct(p);

  const initialPrice = {
    list: p.price_canonical?.list ?? 0,
    sale: p.price_canonical?.sale ?? null,
    display: p.price_canonical?.sale ?? p.price_canonical?.list ?? 0,
    mode: "from" as const,
  };

  return (
    <div className="container mx-auto px-3 py-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* الصور */}
        <div className="order-1 lg:order-1 lg:col-span-8 rounded-2xl border border-zinc-100 bg-white p-3">
          <ImageGallery images={gallery} />
        </div>

        {/* التفاصيل */}
        <aside className="order-2 lg:col-span-4 space-y-6">
          {hasDeal && (
            <div className="flex justify-start lg:justify-end">
              <DealCountdownClient endsAt={p.ends_at!} />
            </div>
          )}

          <div className="text-[10px] uppercase tracking-wide text-zinc-500">
            {p.main_sku && <span>SKU: {p.main_sku}</span>}
            {p.brand_name && (
              <span className="ml-3">VENDOR: {p.brand_name}</span>
            )}
          </div>

          <h1 className="text-[22px] font-semibold leading-snug">{p.name}</h1>

          {/* السعر الحي + شارة المخزون */}
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <PriceDisplayClient initial={initialPrice} />
              {/* تُحدَّث تلقائيًا من حدث selection-changed (NoOptions/Options) */}
              <StockBadgeClient initial={0} />
            </div>
            <div className="text-[11px] text-zinc-500">Taxes included.</div>
            <div className="text-[11px] text-zinc-500">
              Shipping calculated at checkout.
            </div>
          </div>

          {/* تنبيهات */}
          <div className="flex items-center gap-8">
            <ViewersNow count={5} />
            <span className="text-sm text-zinc-500">أهلًا! شحنك صار مجاني</span>
          </div>

          <FreeShippingBarClient
            needed={150}
            initialCurrent={p.price_canonical.sale ?? p.price_canonical.list}
          />

          <div>
            <SizeGuideButton />
          </div>

          {/* لو فيه مجموعات → نرسم OptionsPicker
              لو ما فيه مجموعات → نبث السعر/الكمية من المتغيّرات */}
          <div className="rounded-2xl border border-zinc-100 bg-white p-4">
            {pickerProduct.option_groups &&
            pickerProduct.option_groups.length > 0 ? (
              <OptionsPicker product={pickerProduct} />
            ) : (
              <NoOptionsPriceClient
                productId={p.id}
                variants={pickerProduct.variants}
                basePrice={
                  pickerProduct.base_price_fallback ??
                  p.price_canonical.list ??
                  0
                }
              />
            )}
          </div>

          {/* شريط الإضافة للسلة */}
          <div className="rounded-2xl border border-zinc-100 bg-white p-4">
            <ProductAddBar productId={p.id} />
          </div>
        </aside>
      </div>
    </div>
  );
}
