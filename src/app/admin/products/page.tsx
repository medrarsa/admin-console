// src/app/admin/products/page.tsx
import createServerSupabase from "@/lib/supabase/server";
import ProductsClient from "./ProductsClient";

/* منع الكاش لصفحة الأدمن */
export const revalidate = 0;

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

type DBVariant = { id: string; product_id: string };

type DBPrice = {
  variant_id: string;
  price: number | null;
  sale_price: number | null;
};

type DBInv = { variant_id: string; qty_on_hand: number | null };

export default async function AdminProductsListPage() {
  const supabase = await createServerSupabase();

  // 1) المنتجات
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

  // 2) الصور — نجلب sort_order أيضًا
  const { data: imgsRaw } = await supabase
    .from("product_images")
    .select("product_id,url,is_primary,sort_order")
    .in("product_id", ids);

  const imgs = (imgsRaw ?? []) as DBImage[];

  // 3) الفاريِنتات
  const { data: varsRaw } = await supabase
    .from("product_variants")
    .select("id,product_id")
    .in("product_id", ids);

  const variants = (varsRaw ?? []) as DBVariant[];

  // أول فاريِنت لكل منتج (للاستخدام السريع)
  const firstVarByProduct = new Map<string, string>();
  for (const pid of ids) {
    const v = variants.find((x) => x.product_id === pid);
    if (v) firstVarByProduct.set(pid, v.id);
  }

  const vIds = Array.from(new Set(variants.map((v) => v.id)));

  // 4) الأسعار
  const { data: pricesRaw } = vIds.length
    ? await supabase
        .from("variant_prices")
        .select("variant_id,price,sale_price")
        .in("variant_id", vIds)
    : { data: [] as DBPrice[] };

  const prices = (pricesRaw ?? []) as DBPrice[];
  const priceMap = prices.reduce<
    Map<string, { price: number; sale: number | null }>
  >((acc, r) => {
    if (!acc.has(r.variant_id)) {
      acc.set(r.variant_id, {
        price: r.price ?? 0,
        sale: r.sale_price ?? null,
      });
    }
    return acc;
  }, new Map());

  // 5) المخزون
  const { data: invRaw } = vIds.length
    ? await supabase
        .from("variant_inventory")
        .select("variant_id,qty_on_hand")
        .in("variant_id", vIds)
    : { data: [] as DBInv[] };

  const inv = (invRaw ?? []) as DBInv[];
  const qtyMap = inv.reduce<Map<string, number>>((acc, r) => {
    if (!acc.has(r.variant_id)) acc.set(r.variant_id, r.qty_on_hand ?? 0);
    return acc;
  }, new Map());

  // اختيار صورة (الأولوية للأساسية ثم أقل sort_order)
  const pickImage = (pid: string) => {
    const set = imgs.filter((i) => i.product_id === pid);
    if (!set.length) return undefined;

    const primary = set.find((x) => x.is_primary);
    if (primary?.url) return primary.url || undefined;

    const sorted = set
      .slice()
      .sort((a, b) => (a.sort_order ?? 999999) - (b.sort_order ?? 999999));
    return sorted[0]?.url || undefined;
  };

  // تحويل بيانات الـDB إلى ما يفهمه العميل
  const uiRows = products.map((p) => {
    const vid = firstVarByProduct.get(p.id);
    const pr = vid
      ? priceMap.get(vid) ?? { price: 0, sale: null }
      : { price: 0, sale: null };
    const qty = vid ? qtyMap.get(vid) ?? 0 : 0;

    return {
      id: p.id,
      name: p.name,
      status: p.status,
      imageUrl: pickImage(p.id), // 👈 الأساس/الأول بالترتيب
      price: pr.price,
      salePrice: pr.sale ?? undefined,
      qty,
      tags: [],
      localCategory: null,

      // الحقول التالية للـDialogs — عبّها لاحقًا من جداولك حسب الحاجة
      brand: null,
      sku: "",
      years: "",
      shortTitle: "",
      seoTitleTpl: "{brand} {category} {name} {years}",
      seoSlugTpl: "{brand}-{name}-{years}",
      seoDescTpl:
        "رمز: {sku} — الماركة: {brand} — التصنيف: {category} — اسم المنتج: {name}",

      optionsEnabled: false,
      options: [],
      variants: [],
    };
  });

  return <ProductsClient initialRows={uiRows} />;
}
