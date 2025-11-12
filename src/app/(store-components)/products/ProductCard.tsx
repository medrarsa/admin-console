// app/(store-components)/products/ProductCard.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, Heart, ShoppingCart } from "lucide-react";
import DealCountdown from "./DealCountdown";
import { toEnDigits } from "@/lib/num";

/* ========== أنواع ========== */
type CanonicalPrice = {
  list: number; // سعر القائمة (قبل الخصم)
  sale: number | null; // سعر التخفيض إن وجد
  label: { kind: "sale" | "single" | "range"; text: string }; // شارة جاهزة (مثلاً %خصم أو يبدأ من..)
};

type StoreProduct = {
  id: string;
  slug: string;
  name: string;
  image: string | null;

  /** الحقول القديمة (تبقى للتوافق ولكن لن تعتمد عليها البطاقة بعد الآن) */
  price: number | null;
  sale_price: number | null;
  ends_at: string | null;
  starts_from?: boolean;

  /** الحقل الموحّد من الـ API — مصدر الحقيقة لعرض السعر */
  price_canonical?: CanonicalPrice;

  brand_name: string | null;
};

/* ========== أدوات عرض ========== */
const money = (n?: number | null) =>
  typeof n === "number" && isFinite(n)
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "SAR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n)
    : "";

function formatPrice(p?: CanonicalPrice) {
  if (!p)
    return {
      primary: "",
      secondary: null as string | null,
      badge: null as string | null,
    };

  // إن كان هناك تخفيض
  if (p.sale != null && p.sale < p.list) {
    const primary = toEnDigits(money(p.sale));
    const secondary = toEnDigits(money(p.list));
    // إن كانت الـ API أعطت شارة نسبة جاهزة ضمن label.kind = "sale" فنستخدمها؛ وإلا نحسبها
    const badge =
      p.label?.kind === "sale" && p.label.text
        ? p.label.text
        : `${Math.round(((p.list - p.sale) / p.list) * 100)}% خصم`;
    return { primary, secondary, badge };
  }

  // بدون خصم: إما single أو range (“يبدأ من…”)
  const primary = toEnDigits(money(p.list));
  const badge = p.label?.kind === "range" ? p.label.text : null;
  return { primary, secondary: null, badge };
}

export default function ProductCard({ p }: { p: StoreProduct }) {
  const [imgErr, setImgErr] = React.useState(false);
  const [wish, setWish] = React.useState(false);
  const [adding, setAdding] = React.useState(false);

  /** =================== السعر الموحّد (مصدر الحقيقة) ===================
   * نقرأ دائماً من p.price_canonical إن وُجد. لو غير موجود (لسه ما فعلت الـAPI) نرجع لسلوكك القديم.
   */
  const unified = formatPrice(p.price_canonical);
  const hasUnified = Boolean(p.price_canonical);

  // fallback قديم (فقط لو ما وصل price_canonical)
  const base =
    typeof p.price === "number" && isFinite(p.price) ? p.price : null;
  const sale =
    typeof p.sale_price === "number" &&
    isFinite(p.sale_price) &&
    base != null &&
    p.sale_price! < base
      ? p.sale_price
      : null;

  const hasSaleLegacy = sale != null && base != null;
  const legacyPrimary = hasSaleLegacy
    ? toEnDigits(money(sale))
    : toEnDigits(money(base));
  const legacySecondary = hasSaleLegacy ? toEnDigits(money(base)) : null;

  // “يبدأ من” — في النظام الجديد تأتي من label.kind === "range"، وفي القديم من starts_from
  const showStartsFrom =
    (hasUnified && p.price_canonical!.label?.kind === "range") ||
    (!hasUnified && Boolean(p.starts_from && !hasSaleLegacy && base != null));

  // العد التنازلي: نُبقيه كما كان (يعتمد على ends_at القديمة)
  const showCountdown =
    !!(p.ends_at && new Date(p.ends_at).getTime() > Date.now()) &&
    // لو في unified sale، فهو عرض قائم (نفس المنطق السابق)
    ((hasUnified && p.price_canonical!.sale != null) ||
      (!hasUnified && hasSaleLegacy));

  // شارة الخصم: من unified.badge وإلا من حسابك القديم
  const discountBadge =
    (hasUnified && unified.badge) ||
    (hasSaleLegacy
      ? `خصم ${toEnDigits(`${Math.round(((base! - sale!) / base!) * 100)}%`)}`
      : null);

  const displayPrimary = hasUnified ? unified.primary : legacyPrimary;
  const displaySecondary = hasUnified ? unified.secondary : legacySecondary;

  const handleAddToCart = async () => {
    try {
      setAdding(true);
      const key = "cart";
      const old =
        typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      const list = old ? (JSON.parse(old) as any[]) : [];
      list.push({ productId: p.id, qty: 1 });
      if (typeof window !== "undefined")
        window.localStorage.setItem(key, JSON.stringify(list));
      // TODO: اربط لاحقًا بواجهة API
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      className="
        group relative overflow-hidden rounded-3xl border bg-white
        shadow-sm transition-all hover:shadow-lg
      "
    >
      {/* شارة الخصم العربية */}
      {discountBadge && (
        <div className="absolute start-3 top-3 z-30 rounded-full bg-red-600/95 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
          {discountBadge}
        </div>
      )}

      {/* ===== الصورة + الأوفرلايز ===== */}
      <div className="relative w-full overflow-hidden bg-gray-50">
        <Link href={`/products/${p.slug}`} className="block">
          {/* 4:5 لأناقة الكرت */}
          <div className="relative aspect-[4/5] w-full">
            {p.image && !imgErr ? (
              <Image
                src={p.image}
                alt={p.name}
                fill
                sizes="(max-width:768px) 50vw, 25vw"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                onError={() => setImgErr(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-400">
                No Image
              </div>
            )}
          </div>
        </Link>

        {/* أيقونات عائمة: نظرة سريعة + مفضلة */}
        <div
          className="
            absolute start-3 top-3 z-30 flex flex-direction-col gap-2
            opacity-0 transition-opacity duration-200 group-hover:opacity-100
          "
        >
          <button
            type="button"
            title="نظرة سريعة"
            aria-label="نظرة سريعة"
            className="pointer-events-auto rounded-full bg-white/90 p-2 shadow-sm ring-1 ring-black/5 hover:bg-white"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.dispatchEvent(
                new CustomEvent("quick-view", {
                  detail: { id: p.id, slug: p.slug },
                })
              );
            }}
          >
            <Eye className="h-5 w-5 text-gray-700" />
          </button>

          <button
            type="button"
            title={wish ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
            aria-pressed={wish}
            className={`pointer-events-auto rounded-full p-2 shadow-sm ring-1 ring-black/5 ${
              wish ? "bg-red-100" : "bg-white/90 hover:bg-white"
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setWish((v) => !v);
            }}
          >
            <Heart
              className={`h-5 w-5 ${
                wish ? "text-red-600 fill-red-600" : "text-gray-700"
              }`}
            />
          </button>
        </div>

        {/* العدّاد الصغير */}
        {showCountdown && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20">
            <div className="rounded-2xl bg-white/85 p-2 backdrop-blur-[2px] ring-1 ring-white/70">
              <DealCountdown
                endsAt={p.ends_at!}
                label="عجّل! العرض ينتهي خلال"
                dense
              />
            </div>
          </div>
        )}
      </div>

      {/* ===== المحتوى ===== */}
      <div className="p-4 pt-3">
        <MarqueeBar
          items={["شحن مجاني", "توصيل سريع", "استبدال خلال 7 أيام"]}
        />

        {/* الماركة + الاسم */}
        <div className="mt-2 min-w-0">
          {p.brand_name && (
            <div className="mb-0.5 truncate text-[11px] text-gray-500">
              {p.brand_name}
            </div>
          )}
          <Link
            href={`/products/${p.slug}`}
            className="line-clamp-2 block text-[14] font-medium leading-5"
            title={p.name}
          >
            {p.name}
          </Link>
        </div>

        {/* الأسعار + “يبدأ من” */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="text-[12px] text-gray-400 line-through leading-4">
            {displaySecondary ?? "\u00A0"}
          </div>

          <span className="text-xl font-semibold text-red-600">
            {displayPrimary || "—"}
          </span>

          {showStartsFrom && (
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600">
              {hasUnified &&
              p.price_canonical?.label?.kind === "range" &&
              p.price_canonical?.label?.text
                ? p.price_canonical.label.text
                : "يبدأ من"}
            </span>
          )}
        </div>

        {/* زر أضف إلى السلة */}
        <div className="mt-3">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={adding}
            className="
              inline-flex w-full items-center justify-center gap-2
              rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white
              hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70
            "
            title="أضف إلى السلة"
          >
            <ShoppingCart className="h-4 w-4" />
            {adding ? "جاري الإضافة…" : "أضف إلى السلة"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ====== Marquee Bar (شريط شارات متحرّكة) ====== */
function MarqueeBar({ items }: { items: string[] }) {
  const list = [...items, ...items]; // تكرار سلس
  return (
    <div className="relative overflow-hidden rounded-xl border bg-gray-50">
      <div
        className="flex animate-[marquee_14s_linear_infinite] gap-3 px-3 py-1.5"
        dir="rtl"
      >
        {list.map((t, i) => (
          <span
            key={i}
            className="shrink-0 rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-[11px] text-gray-700"
          >
            {t}
          </span>
        ))}
      </div>
      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
