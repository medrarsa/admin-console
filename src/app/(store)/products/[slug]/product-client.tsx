"use client";
import * as React from "react";
import Image from "next/image";
import SlimTimer from "@/app/(store-components)/products/SlimTimer";
import { fetchProductDetail, type ProductDetail } from "@/lib/store/products";
import { toEnDigits } from "@/lib/num";

const sar = (n?: number | null) =>
  typeof n === "number" && isFinite(n)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "SAR", minimumFractionDigits: 2 }).format(n)
    : "";

type Props = { slug: string; initial?: ProductDetail };

export default function ProductClient({ slug, initial }: Props) {
  const [p, setP] = React.useState<ProductDetail | null>(initial ?? null);
  const [activeImg, setActiveImg] = React.useState<string | null>(initial?.image ?? null);
  const [selected, setSelected] = React.useState<string | null>(null); // variant_id
  const [loading, setLoading] = React.useState(!initial);

  React.useEffect(() => {
    if (initial) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const data = await fetchProductDetail(slug);
      if (!alive) return;
      setP(data);
      setActiveImg(data?.image ?? null);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [slug, initial]);

  if (loading || !p) {
    return <div className="mx-auto max-w-screen-lg px-3 py-8 text-center text-sm text-neutral-500">جارٍ التحميل…</div>;
  }

  // سعر العرض الحالي (يتغيّر عند اختيار Variant)
  const activeVariant = p.variants.find((v) => v.id === selected) ?? null;
  const basePrice = activeVariant?.price ?? p.price ?? 0;
  const salePrice = activeVariant?.sale_price ?? p.sale_price ?? null;
  const endsAt = activeVariant?.ends_at ?? p.ends_at ?? null;
  const hasSale = !!(salePrice && basePrice && salePrice < basePrice);

  const priceText = toEnDigits(sar(hasSale ? salePrice : basePrice));
  const baseText = toEnDigits(sar(basePrice));

  // مجموعات الخيارات (من attrs)
  const attrs = p.variants.map(v => v.attrs || {});
  const keys = Array.from(new Set(attrs.flatMap(o => Object.keys(o))));
  const optionsByKey = new Map<string, string[]>();
  keys.forEach(k => {
    const vals = Array.from(new Set(attrs.map(o => o[k]).filter(Boolean) as string[]));
    optionsByKey.set(k, vals);
  });

  // اختيار variant بناءً على attrs المختارة
  const [picked, setPicked] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    if (!keys.length) return;
    // ابحث عن variant يطابق المختار
    const v = p.variants.find(v => {
      const a = v.attrs || {};
      return keys.every(k => !picked[k] || a[k] === picked[k]);
    });
    setSelected(v?.id ?? null);
  }, [picked, p.variants, keys]);

  // وظائف
  const onAdd = () => {
    const key = "cart";
    const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    const list = raw ? (JSON.parse(raw) as any[]) : [];
    list.push({ productId: p.id, variantId: selected, qty: 1 });
    if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(list));
  };

  return (
    <div className="mx-auto max-w-screen-lg px-3 py-4 md:py-8">
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        {/* ====== الصور ====== */}
        <div className="relative">
          <div className="relative overflow-hidden rounded-3xl bg-gray-50">
            <div className="relative aspect-[4/5] w-full">
              {activeImg ? (
                <Image src={activeImg} alt={p.name} fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-300">No Image</div>
              )}
            </div>
            {hasSale && endsAt && new Date(endsAt).getTime() > Date.now() && (
              <SlimTimer endsAt={endsAt} className="absolute inset-x-3 bottom-3" />
            )}
          </div>

          {/* شرائح مصغّرة */}
          {p.gallery.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {p.gallery.map((g, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(g)}
                  className={`relative aspect-square overflow-hidden rounded-xl ring-1 ring-black/5 ${activeImg === g ? "outline outline-2 outline-black/40" : ""}`}
                >
                  <Image src={g} alt="" fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ====== التفاصيل ====== */}
        <div className="flex flex-col">
          <div className="mb-2">
            {p.brand_name && <div className="text-xs text-gray-500">{p.brand_name}</div>}
            <h1 className="text-lg font-semibold leading-6 md:text-2xl">{p.name}</h1>
          </div>

          {/* السعر */}
          <div className="mt-1 flex items-baseline gap-3">
            {hasSale ? (
              <>
                <div className="text-2xl font-semibold text-gray-900 md:text-3xl">{priceText}</div>
                <div className="text-sm text-gray-400 line-through">{baseText}</div>
              </>
            ) : (
              <div className="text-2xl font-semibold text-gray-900 md:text-3xl">{priceText}</div>
            )}
          </div>

          {/* خيارات المنتج (بُنيت آليًا من attrs) */}
          {keys.length > 0 && (
            <div className="mt-5 space-y-4">
              {keys.map((k) => (
                <div key={k}>
                  <div className="mb-1 text-sm font-medium">{k}</div>
                  <div className="flex flex-wrap gap-2">
                    {optionsByKey.get(k)!.map((val) => {
                      const active = picked[k] === val;
                      return (
                        <button
                          key={val}
                          onClick={() => setPicked({ ...picked, [k]: active ? "" : val })}
                          className={`rounded-xl border px-3 py-1.5 text-sm ${active ? "border-black bg-black text-white" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* مواصفات قابلة للطيّ */}
          <div className="mt-6 divide-y rounded-2xl border">
            <details className="group open:rounded-2xl">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                المواصفات
              </summary>
              <div className="px-4 pb-4 text-sm text-gray-700 leading-6">
                {/* بدّل هذا بداتا حقيقية من product_specs لاحقًا */}
                خامة عالية، ضمان 12 شهر، مناسب للموديلات الشائعة.
              </div>
            </details>
            <details className="group">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                التوصيل والاسترجاع
              </summary>
              <div className="px-4 pb-4 text-sm text-gray-700 leading-6">
                شحن مجاني للطلبات فوق 199 ريال. استرجاع خلال 7 أيام بشرط سلامة التغليف.
              </div>
            </details>
          </div>

          {/* زر السلة (دسكتوب) */}
          <div className="mt-6 hidden md:block">
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white hover:opacity-90 active:scale-[0.99]"
            >
              أضف إلى السلة
            </button>
          </div>
        </div>
      </div>

      {/* Sticky للجوال */}
      <div className="md:hidden" />
      <div className="h-16 md:hidden" /> {/* spacer للشريط */}
      <div className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-screen-sm items-center gap-2 px-3 py-3">
          <button
            type="button"
            onClick={() => {/* fav later */}}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border bg-gray-50"
            aria-label="المفضلة"
          >
            {/* أيقونة قلب بسيطة */}
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-gray-700"><path fill="currentColor" d="M12.1 21.35l-1.1-1.01C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41.81 4.5 2.09C12.09 4.81 13.76 4 15.5 4 18 4 20 6 20 8.5c0 3.78-3.4 6.86-8.99 11.84l-1.11 1.01z"/></svg>
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-medium text-white"
          >
            أضف إلى السلة
          </button>
        </div>
      </div>
    </div>
  );
}
