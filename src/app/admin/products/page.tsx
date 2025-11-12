// src/app/admin/products/page.tsx
import createServerSupabase, {
  createServiceRoleSupabase,
} from "@/lib/supabase/server";
import ProductsClient from "./ProductsClient";

/* منع الكاش لصفحة الأدمن */
export const revalidate = 0;

/* أنواع مختصرة */
type DBProduct = {
  id: string;
  name: string;
  status: "active" | "draft" | "archived" | "hidden" | "sale" | "out";
};

type DBImage = {
  product_id: string;
  url: string | null;
  is_primary: boolean | null;
  sort_order: number | null;
};

type DBVariant = { id: string; product_id: string; status?: string | null };

type DBPrice = {
  variant_id: string;
  price: number | null;
  sale_price: number | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

type DBInv = {
  variant_id: string;
  qty_on_hand: number | null;
  qty_reserved?: number | null;
};

type PrimaryPriceRow = {
  variant_id: string;
  list_price: number | null;
  sale_price: number | null;
  starts_at: string | null;
  ends_at: string | null;
};

const nf = new Intl.NumberFormat("ar-SA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const makePriceLabel = (min?: number | null, max?: number | null) => {
  if (min == null || max == null) return null;
  return min === max
    ? nf.format(min)
    : `يبدأ من ${nf.format(min)} إلى ${nf.format(max)}`;
};

export default async function AdminProductsListPage() {
  const supabase = await createServerSupabase(); // عميل الجلسة (RLS)
  const adminRead = createServiceRoleSupabase(); // قراءة مضمونة للصور

  /* 1) المنتجات */
  const { data: productsRaw, error: e1 } = await supabase
    .from("products")
    .select("id,name,status")
    .order("name", { ascending: true })
    .limit(60);

  if (e1) {
    return (
      <div className="content" dir="rtl">
        <h1 className="mb-2 text-xl font-bold">المنتجات</h1>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
          فشل الجلب: {e1.message}
        </div>
      </div>
    );
  }

  const products = (productsRaw ?? []) as DBProduct[];

  if (!products.length) {
    return (
      <div className="content space-y-4" dir="rtl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold">المنتجات</h1>
          <button className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white">
            منتج جديد
          </button>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-500">
          لا توجد منتجات بعد.
        </div>
      </div>
    );
  }

  const ids = products.map((p) => p.id);

  /* 2) الصور (service-role) */
  const { data: imgsRaw } = await adminRead
    .from("product_images")
    .select("product_id,url,is_primary,sort_order")
    .in("product_id", ids);

  const imgs = (imgsRaw ?? []) as DBImage[];

  const pickImage = (pid: string) => {
    const set = imgs.filter((i) => i.product_id === pid);
    if (!set.length) return undefined;
    const primary = set.find((x) => x.is_primary);
    if (primary?.url) return primary.url || undefined;
    const sorted = set
      .slice()
      .sort((a, b) => (a.sort_order ?? 999_999) - (b.sort_order ?? 999_999));
    return sorted[0]?.url || undefined;
  };

  /* 3) الفاريِنتات الفعالة */
  const { data: varsRaw } = await supabase
    .from("product_variants")
    .select("id,product_id,status")
    .in("product_id", ids);

  const variants = (varsRaw ?? []) as DBVariant[];
  const activeVariants = variants.filter(
    (v) => (v.status ?? "active") === "active"
  );
  const vIds = activeVariants.map((v) => v.id);

  /* 4) أحدث سعر لكل variant (variant_prices) */
  const { data: pricesRaw } = vIds.length
    ? await supabase
        .from("variant_prices")
        .select("variant_id,price,sale_price,starts_at,ends_at,created_at")
        .in("variant_id", vIds)
    : { data: [] as DBPrice[] };

  const priceLatest = new Map<string, DBPrice>();
  (pricesRaw ?? [])
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .forEach((r) => {
      if (!priceLatest.has(r.variant_id)) priceLatest.set(r.variant_id, r);
    });

  /* 5) المخزون لكل variant (variant_inventory) */
  const { data: invRaw } = vIds.length
    ? await supabase
        .from("variant_inventory")
        .select("variant_id,qty_on_hand,qty_reserved")
        .in("variant_id", vIds)
    : { data: [] as DBInv[] };

  const qtyByVariant = new Map<string, number>();
  (invRaw ?? []).forEach((r) => {
    const free = Math.max((r.qty_on_hand ?? 0) - (r.qty_reserved ?? 0), 0);
    qtyByVariant.set(r.variant_id, free);
  });

  /* 6) السعر الأساسي للـ main (product_primary_price) */
  const { data: primRows } = vIds.length
    ? await supabase
        .from("product_primary_price")
        .select("variant_id,list_price,sale_price,starts_at,ends_at")
        .in("variant_id", vIds)
    : { data: [] as PrimaryPriceRow[] };

  const primaryByVariant = new Map<string, PrimaryPriceRow>();
  (primRows ?? []).forEach((r) => primaryByVariant.set(r.variant_id, r));

  /* 7) صفوف الواجهة (حسم نهائي في السيرفر) */
  const uiRows = products.map((p) => {
    const pVars = activeVariants.filter((v) => v.product_id === p.id);
    const main = pVars[0];
    const opts = main ? pVars.filter((v) => v.id !== main.id) : [];

    // أسعار الخيارات (الثانوي فقط)
    const optPrices: number[] = [];
    for (const v of opts) {
      const pr = priceLatest.get(v.id);
      const base = typeof pr?.price === "number" ? Number(pr!.price) : null;
      if (typeof base === "number" && base > 0) optPrices.push(base);
    }
    const hasOptionPrice = optPrices.length > 0;
    const variants_price_min = hasOptionPrice ? Math.min(...optPrices) : null;
    const variants_price_max = hasOptionPrice ? Math.max(...optPrices) : null;
    const variants_price_label = hasOptionPrice
      ? makePriceLabel(variants_price_min, variants_price_max)
      : null;

    // كميات الخيارات (الثانوي فقط)
    let optQty = 0;
    for (const v of opts) {
      const free = qtyByVariant.get(v.id) ?? 0;
      if (free > 0) optQty += free;
    }
    const hasOptionQty = optQty > 0;

    // أساس الـ main
    const basePrice =
      main && typeof primaryByVariant.get(main.id)?.list_price === "number"
        ? Number(primaryByVariant.get(main.id)!.list_price)
        : undefined;
    const baseQty = main ? qtyByVariant.get(main.id) ?? 0 : 0;

    // ===== القيم النهائية =====
    const resolved_price = hasOptionPrice
      ? (variants_price_min as number)
      : basePrice;
    const resolved_qty = hasOptionQty ? optQty : baseQty;
    const lock_price = hasOptionPrice; // اقفل فقط لو عندك أسعار خيارات
    const lock_qty = hasOptionQty; // اقفل فقط لو عندك كميات خيارات

    return {
      id: p.id,
      name: p.name,
      status: p.status,
      imageUrl: pickImage(p.id),

      // النهائي الجاهز للعرض
      resolved_price,
      resolved_qty,
      lock_price,
      lock_qty,

      // للعرض الإضافي
      variants_price_min,
      variants_price_max,
      variants_price_label,
      variants_total_qty: optQty,
    };
  });

  // ⚠️ cast بسيط لأن ProductsClient.Product قد لا يعرّف جميع هذه الحقول
  return <ProductsClient initialRows={uiRows as any} />;
}
