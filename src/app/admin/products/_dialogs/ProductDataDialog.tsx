// src/app/admin/products/_dialogs/ProductDataDialog.tsx
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Product } from "../ProductsClient";

/* ===== TinyMCE داخل المودال (بدون SSR) ===== */
const TinymceEditor = dynamic(
  () => import("@tinymce/tinymce-react").then((m) => m.Editor),
  { ssr: false }
);

/* ===== Helpers ===== */
const money = (v?: number) =>
  typeof v !== "number" || isNaN(v)
    ? ""
    : new Intl.NumberFormat("ar-SA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(v);

const percent = (p?: number, s?: number) =>
  !p || !s || s >= p ? 0 : Math.round(((p - s) / p) * 100);

const slugify = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\u0600-\u06FF\w-]/g, "")
    .replace(/-+/g, "-")
    .toLowerCase();

const toYMD = (s?: string | null) => (s ? s.slice(0, 10) : "");

/** يطبّع الأرقام العربية/الفارسية إلى لاتينية ويزيل الفواصل ثم يحوّل لرقم */
function toNumberLoose(input: string): number | undefined {
  if (!input) return undefined;
  const map: Record<string, string> = {
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9",
  };
  const normalized = input
    .trim()
    .replace(/[٠-٩۰-۹]/g, (d) => map[d])
    .replace(/,/g, "")
    .replace(/\s/g, "");
  if (normalized === "" || normalized === "-") return undefined;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}

const tokens = (tpl: string, ctx: any) => {
  const discount =
    ctx.price && ctx.sale && ctx.sale < ctx.price
      ? +(ctx.price - ctx.sale).toFixed(2)
      : undefined;
  const prc =
    ctx.price && ctx.sale && ctx.sale < ctx.price
      ? percent(ctx.price, ctx.sale)
      : undefined;
  return tpl
    .replace(/\{brand\}/gi, ctx.brand ?? "")
    .replace(/\{category\}/gi, ctx.category ?? "")
    .replace(/\{sku\}/gi, ctx.sku ?? "")
    .replace(/\{name\}/gi, ctx.name ?? "")
    .replace(/\{years\}/gi, ctx.years ?? "")
    .replace(/\{discount\}/gi, discount != null ? String(discount) : "")
    .replace(/\{percent\}/gi, prc != null ? String(prc) : "");
};

/* ===== API ===== */
async function getProductDetails(id: string) {
  const r = await fetch(`/api/admin/products/${id}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.success) throw new Error(j?.error || `GET ${r.status}`);
  return j.data as any;
}
async function patchProduct(id: string, payload: Record<string, any>) {
  const r = await fetch(`/api/admin/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.success) throw new Error(j?.error || `PATCH ${r.status}`);
  return j.data;
}
/** جلب الماركات (Lite) */
async function fetchBrandsLite(q = "", page = 1, per = 200) {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  sp.set("page", String(page));
  sp.set("per", String(per));
  const r = await fetch(`/api/admin/brands?${sp.toString()}`, {
    cache: "no-store",
  });
  const j = await r.json();
  const options = (j?.data ?? []).map((b: any) => ({ id: b.id, name: b.name }));
  return { options, total: j?.total ?? options.length };
}

/** الوسوم (Lite) */
async function fetchTagsLite(q = "", page = 1, per = 50) {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  sp.set("page", String(page));
  sp.set("per", String(per));
  const r = await fetch(`/api/admin/tags?${sp.toString()}`, {
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({ data: [], total: 0 }));
  return {
    options: (j?.data ?? []).map((t: any) => ({ id: t.id, name: t.name })),
    total: j?.total ?? 0,
  };
}
async function createTagByName(name: string) {
  const r = await fetch(`/api/admin/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.success) throw new Error(j?.error || `POST ${r.status}`);
  return j.data as { id: string; name: string };
}

/* ===== مكوّن الإدخال بأسلوب سلة ===== */
function TagInput({
  placeholder,
  suggestions,
  loading,
  onQueryChange,
  onAddExisting,
  onCreateNew,
}: {
  placeholder?: string;
  suggestions: Array<{ id: string; name: string }>;
  loading: boolean;
  onQueryChange: (q: string) => void;
  onAddExisting: (id: string) => void;
  onCreateNew: (name: string) => void | Promise<void>;
}) {
  const [value, setValue] = React.useState("");
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setOpen(Boolean(value.trim()) || loading);
  }, [value, loading]);

  async function addCurrent() {
    const v = value.trim();
    if (!v) return;
    const hit = suggestions.find((s) => s.name === v);
    if (hit) {
      onAddExisting(hit.id);
      setValue("");
      setOpen(false);
      return;
    }
    await onCreateNew(v);
    setValue("");
    setOpen(false);
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void addCurrent();
    }
    if (e.key === "Escape") setOpen(false);
  }

  return (
    <div className="w-full">
      <label className="mb-1 block text-xs text-zinc-600">أدخل الوسم هنا</label>
      <div className="relative flex w-full items-stretch gap-2">
        <button
          type="button"
          className="rounded-xl bg-gradient-to-l from-teal-600 to-sky-600 px-3 py-2 text-sm font-semibold text-white"
          onClick={addCurrent}
        >
          + وسم جديد
        </button>

        <div className="flex-1">
          <input
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none"
            placeholder={placeholder || "ابحث أو اكتب وسمًا…"}
            value={value}
            onChange={(e) => {
              const q = e.currentTarget.value;
              setValue(q);
              onQueryChange(q);
            }}
            onKeyDown={onKeyDown}
            onFocus={() => setOpen(true)}
          />
          {open && (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-zinc-200 bg-white shadow-lg">
              {loading ? (
                <div className="px-3 py-2 text-[12px] text-zinc-500">يبحث…</div>
              ) : suggestions.length === 0 ? (
                <div className="px-3 py-2 text-[12px] text-zinc-500">
                  لا يوجد اقتراحات. اضغط <b>Enter</b> لإضافة “{value.trim()}”.
                </div>
              ) : (
                suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-right text-sm hover:bg-zinc-50"
                    onClick={() => {
                      onAddExisting(s.id);
                      setValue("");
                      setOpen(false);
                    }}
                  >
                    <span>{s.name}</span>
                    <span className="text-[11px] text-zinc-400">إضافة</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
          onClick={() => onQueryChange(value.trim())}
          disabled={loading}
        >
          {loading ? "يبحث…" : "تحديث"}
        </button>
      </div>

      <div className="mt-1 text-[11px] text-zinc-500">
        * أدخل الوسم ثم اضغط <b>Enter</b> أو زر <b>+ وسم جديد</b>.
      </div>
    </div>
  );
}

/* ===== Component ===== */
export default function ProductDataDialog({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved: (patch: Partial<Product>) => void;
}) {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // شارة تأكيد الحفظ (اختياري)
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const [refreshingAfterSave, setRefreshingAfterSave] = React.useState(false);

  // basics
  const [name, setName] = React.useState(product.name);
  const [sku, setSku] = React.useState<string>(product.sku ?? "");

  // brand
  const [brandId, setBrandId] = React.useState<string | null>(null);
  const [brandName, setBrandName] = React.useState<string>(product.brand ?? "");

  // prices
  const [basePrice, setBasePrice] = React.useState<number | undefined>(
    product.price
  );
  const [costPrice, setCostPrice] = React.useState<number | undefined>(
    product.costPrice
  );
  const [costPriceStr, setCostPriceStr] = React.useState<string>("");
  const [salePrice, setSalePrice] = React.useState<number | undefined>(
    product.salePrice ?? product.price
  );
  const [salePriceStr, setSalePriceStr] = React.useState<string>("");
  const [discountEnd, setDiscountEnd] = React.useState(
    product.discountEnd ?? ""
  );

  // SEO/content
  const [shortTitle, setShortTitle] = React.useState(product.shortTitle ?? "");
  const [years, setYears] = React.useState(product.years ?? "");
  const [descHTML, setDescHTML] = React.useState(product.descriptionHtml ?? "");
  const [seoTitleTpl, setSeoTitleTpl] = React.useState(
    product.seoTitleTpl ?? "{brand} {category} {name} {years}"
  );
  const [seoSlugTpl, setSeoSlugTpl] = React.useState(
    product.seoSlugTpl ?? "{brand}-{name}-{years}"
  );
  const [seoDescTpl, setSeoDescTpl] = React.useState(
    product.seoDescTpl ?? "{sku} — {brand} — {category} — {name}"
  );

  const ctx = React.useMemo(
    () => ({
      brand: brandName,
      category: product.localCategory ?? null,
      sku,
      name,
      years,
      price: basePrice,
      sale: salePrice,
    }),
    [brandName, product.localCategory, sku, name, years, basePrice, salePrice]
  );

  /* ===== Brands state ===== */
  const [brandQ, setBrandQ] = React.useState("");
  const [brandOpts, setBrandOpts] = React.useState<
    Array<{ id: string; name: string }>
  >([]);
  const [brandLoading, setBrandLoading] = React.useState(false);

  /* ===== Tags state ===== */
  const [tagsQ, setTagsQ] = React.useState("");
  const [tagOpts, setTagOpts] = React.useState<
    Array<{ id: string; name: string }>
  >([]);
  const [tagLoading, setTagLoading] = React.useState(false);
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>(
    Array.isArray((product as any).tagIds)
      ? ((product as any).tagIds as string[])
      : []
  );
  const initialTagIdsRef = React.useRef<string[]>(selectedTagIds);
  const [tagMap, setTagMap] = React.useState<Record<string, string>>({}); // id -> name

  /* ===== fetch on open ===== */
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const d = await getProductDetails(product.id);

        if (typeof d?.name === "string") setName(d.name);
        setSku(
          d?.sku ??
            d?.main_sku ??
            (Array.isArray(d?.skus) && d.skus[0]?.sku) ??
            sku
        );

        if (d?.brand?.id) setBrandId(d.brand.id);
        if (d?.brand?.name) setBrandName(d.brand.name ?? "");

        const firstSku =
          Array.isArray(d?.skus) && d.skus.length ? d.skus[0] : null;
        const cp =
          typeof d?.main_cost_price === "number"
            ? d.main_cost_price
            : typeof firstSku?.cost_price === "number"
            ? firstSku.cost_price
            : undefined;
        setCostPrice(cp);
        setCostPriceStr(typeof cp === "number" ? String(cp) : "");

        const bp =
          typeof d?.price?.amount === "number" ? d.price.amount : product.price;
        setBasePrice(bp);

        const sp =
          typeof d?.sale_price?.amount === "number"
            ? d.sale_price.amount
            : typeof product.salePrice === "number"
            ? product.salePrice
            : product.price;
        setSalePrice(sp);
        setSalePriceStr(typeof sp === "number" ? String(sp) : "");

        setDiscountEnd(toYMD(d?.sale_end) || toYMD(product.discountEnd) || "");

        setShortTitle(d?.short_title ?? product.shortTitle ?? "");
        setYears(d?.years ?? product.years ?? "");
        setDescHTML(d?.description_html ?? product.descriptionHtml ?? "");
        setSeoTitleTpl(
          d?.seo_title_tpl ??
            product.seoTitleTpl ??
            "{brand} {category} {name} {years}"
        );
        setSeoSlugTpl(
          d?.seo_slug_tpl ?? product.seoSlugTpl ?? "{brand}-{name}-{years}"
        );
        setSeoDescTpl(
          d?.seo_desc_tpl ??
            product.seoDescTpl ??
            "{sku} — {brand} — {category} — {name}"
        );

        if (Array.isArray(d?.tags)) {
          const ids = d.tags.map((t: any) => t.id).filter(Boolean);
          setSelectedTagIds(ids);
          initialTagIdsRef.current = ids;
          const map: Record<string, string> = {};
          d.tags.forEach((t: any) => {
            if (t?.id && t?.name) map[t.id] = t.name;
          });
          setTagMap(map);
        } else if (Array.isArray(d?.tag_ids)) {
          setSelectedTagIds(d.tag_ids);
          initialTagIdsRef.current = d.tag_ids;
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [product.id]); // eslint-disable-line

  // جلب الماركات
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setBrandLoading(true);
        const { options } = await fetchBrandsLite(brandQ, 1, 200);
        if (alive) setBrandOpts(options);
      } finally {
        if (alive) setBrandLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [brandQ]);

  // جلب الوسوم (اقتراحات) + تحديث خريطة الأسماء
  type TagOption = { id: string; name: string };
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setTagLoading(true);
        const { options } = await fetchTagsLite(tagsQ, 1, 50);
        if (alive) setTagOpts(options as TagOption[]);
        if (alive) {
          setTagMap((prev) => {
            const next: Record<string, string> = { ...prev };
            (options as TagOption[]).forEach((o: TagOption) => {
              if (o && typeof o.id === "string" && typeof o.name === "string") {
                next[o.id] = o.name;
              }
            });
            return next;
          });
        }
      } finally {
        if (alive) setTagLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tagsQ]);

  /* ===== build & send patch ===== */
  function buildPatch() {
    const patch: Record<string, any> = {};

    if (name.trim() !== product.name.trim()) patch.name = name.trim();
    if ((sku || "") !== (product.sku || "")) patch.sku = sku || null;

    const costNum = toNumberLoose(costPriceStr);
    if (costPriceStr.trim() !== "" && costNum !== undefined)
      patch.costPrice = costNum;

    const saleNum = toNumberLoose(salePriceStr);
    if (salePriceStr.trim() !== "" && saleNum !== undefined)
      patch.salePrice = saleNum;

    patch.discountEnd = discountEnd || null;

    if (brandId) patch.brandId = brandId;
    else patch.brand = brandName || null;

    if (shortTitle !== (product.shortTitle || ""))
      patch.shortTitle = shortTitle || null;
    if ((years || "") !== (product.years || "")) patch.years = years || null;
    if (descHTML !== (product.descriptionHtml || ""))
      patch.descriptionHtml = descHTML || null;
    if (seoTitleTpl !== (product.seoTitleTpl || ""))
      patch.seoTitleTpl = seoTitleTpl || null;
    if (seoSlugTpl !== (product.seoSlugTpl || ""))
      patch.seoSlugTpl = seoSlugTpl || null;
    if (seoDescTpl !== (product.seoDescTpl || ""))
      patch.seoDescTpl = seoDescTpl || null;

    const initial = (initialTagIdsRef.current ?? []).slice().sort().join(",");
    const current = (selectedTagIds ?? []).slice().sort().join(",");
    if (initial !== current) patch.tagIds = selectedTagIds;

    return patch;
  }

  async function saveNow() {
    try {
      setSaving(true);
      const patch = buildPatch();

      // تحديث متفائل
      onSaved({
        name,
        sku,
        brand: brandId
          ? brandOpts.find((o) => o.id === brandId)?.name ?? brandName
          : brandName,
        costPrice:
          costPriceStr.trim() !== "" ? toNumberLoose(costPriceStr) : undefined,
        salePrice:
          salePriceStr.trim() !== "" ? toNumberLoose(salePriceStr) : undefined,
        discountEnd,
        shortTitle,
        years,
        descriptionHtml: descHTML,
        seoTitleTpl,
        seoSlugTpl,
        seoDescTpl,
        ...(patch.tagIds ? { tagIds: selectedTagIds } : {}),
      });

      // 1) PATCH => كتابة فعلية في DB
      await patchProduct(product.id, patch);

      // 2) GET تأكيدي من DB لتحديث الحالة من مصدر الحقيقة
      setRefreshingAfterSave(true);
      const fresh = await getProductDetails(product.id);

      if (Array.isArray(fresh?.tags)) {
        const ids = fresh.tags.map((t: any) => t.id).filter(Boolean);
        setSelectedTagIds(ids);
        // تحديث خريطة أسماء الوسوم
        setTagMap((m) => {
          const n = { ...m };
          fresh.tags.forEach((t: any) => {
            if (t?.id && t?.name) n[t.id] = t.name;
          });
          return n;
        });
      }
      if (typeof fresh?.sku === "string") setSku(fresh.sku);
      if (typeof fresh?.description_html === "string")
        setDescHTML(fresh.description_html);

      setLastSavedAt(new Date().toLocaleTimeString());
      alert("✅ تم الحفظ والتأكيد من القاعدة");
      onClose();
    } catch (e: any) {
      alert(`❌ فشل الحفظ: ${e?.message || e}`);
    } finally {
      setRefreshingAfterSave(false);
      setSaving(false);
    }
  }

  /* ===== UI ===== */
  if (loading) {
    return (
      <div className="fixed inset-0 z-[999] grid place-items-center bg-black/40 p-4">
        <div className="rounded-2xl bg-white px-6 py-4 shadow-xl ring-1 ring-zinc-200">
          <div className="flex items-center gap-3">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
            <span className="text-sm font-medium">تحميل بيانات المنتج…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[999] grid place-items-center bg-black/50 backdrop-blur-md p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-white/20 bg-white/80 shadow-[0_20px_60px_-10px_rgba(0,0,0,.35)] ring-1 ring-black/5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/30 bg-gradient-to-l from-teal-600/10 via-sky-500/10 to-fuchsia-500/10 px-5 py-4">
          <h3 className="m-0 text-base font-extrabold">
            <span className="bg-gradient-to-l from-teal-600 via-sky-600 to-fuchsia-600 bg-clip-text text-transparent">
              بيانات المنتج
            </span>{" "}
            <span className="text-zinc-800">({name})</span>
          </h3>
          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-200/60 bg-white/80 px-3 py-1.5 text-sm"
          >
            إغلاق
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[78vh] overflow-y-auto space-y-5 px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* السعر الأساسي (عرض فقط) */}
            <div className="rounded-2xl border border-zinc-200/70 bg-white/80 p-4">
              <label className="mb-1 block text-xs text-zinc-600">
                السعر الأساسي (عرض فقط)
              </label>
              <input
                disabled
                value={typeof basePrice === "number" ? money(basePrice) : ""}
                className="w-full rounded-xl border border-zinc-200/70 bg-zinc-50 px-3 py-2 text-sm text-zinc-600"
              />
            </div>

            {/* سعر التكلفة */}
            <div className="rounded-2xl border border-zinc-200/70 bg-white/80 p-4">
              <label className="mb-1 block text-xs text-zinc-600">
                سعر التكلفة
              </label>
              <input
                inputMode="decimal"
                placeholder="أدخل السعر (مثال: 120 أو ١٢٠)"
                className="w-full rounded-xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm outline-none"
                value={costPriceStr}
                onChange={(e) => {
                  const str = e.target.value;
                  setCostPriceStr(str);
                  const n = toNumberLoose(str);
                  setCostPrice(n);
                }}
              />
              <div className="mt-1 text-[12px] text-zinc-500">
                * يُحفظ في <code>product_variants.cost_price</code> للـSKU
                الرئيسي.
              </div>
            </div>

            {/* السعر المخفض */}
            <div className="rounded-2xl border border-zinc-200/70 bg-white/80 p-4">
              <label className="mb-1 block text-xs text-zinc-600">
                السعر المخفّض
              </label>
              <input
                inputMode="decimal"
                placeholder="مثال: 90 أو ٩٠"
                className="w-full rounded-2xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm outline-none"
                value={salePriceStr}
                onChange={(e) => {
                  const str = e.target.value;
                  setSalePriceStr(str);
                  const n = toNumberLoose(str);
                  setSalePrice(n);
                }}
              />
              <div className="mt-1 text-[12px] text-zinc-600">
                {basePrice && salePrice && salePrice < basePrice ? (
                  <>
                    مبلغ الخصم:{" "}
                    <b className="text-emerald-700">
                      {money(basePrice - salePrice)}
                    </b>{" "}
                    — نسبة الخصم:{" "}
                    <b className="text-emerald-700">
                      {percent(basePrice, salePrice)}%
                    </b>
                  </>
                ) : (
                  <span className="text-zinc-400">
                    أدخل السعر الأساسي والسعر المخفّض لاحتساب الخصم
                  </span>
                )}
              </div>
            </div>

            {/* نهاية التخفيض */}
            <div className="rounded-2xl border border-zinc-200/70 bg-white/80 p-4">
              <label className="mb-1 block text-xs text-zinc-600">
                نهاية التخفيض (اختياري)
              </label>
              <input
                type="date"
                className="w-full rounded-xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm outline-none"
                value={discountEnd}
                onChange={(e) => setDiscountEnd(e.target.value)}
              />
            </div>

            {/* Brand — قائمة ديناميكية */}
            <div className="rounded-2xl border border-zinc-200/70 bg-white/80 p-4">
              <label className="mb-1 block text-xs text-zinc-600">
                الماركة
              </label>

              <input
                className="mb-2 w-full rounded-xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm outline-none"
                placeholder="ابحث عن ماركة…"
                value={brandQ}
                onChange={(e) => setBrandQ(e.currentTarget.value)}
              />

              <select
                className="w-full rounded-xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm outline-none"
                value={brandId ?? ""}
                onChange={(e) => {
                  const id = e.currentTarget.value || null;
                  setBrandId(id);
                  if (id) {
                    const hit = brandOpts.find((b) => b.id === id);
                    setBrandName(hit?.name ?? "");
                  }
                }}
              >
                <option value="">
                  {brandLoading ? "يحمّل الماركات…" : "— اختر ماركة —"}
                </option>
                {brandOpts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>

              {/* خيار إدخال اسم حرّ */}
              <div className="mt-2 text-[12px] text-zinc-500">
                أو اكتب اسمًا حرًّا:
              </div>
              <input
                className="mt-1 w-full rounded-xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm outline-none"
                placeholder="مثال: DENSO / AISIN"
                value={brandName}
                onChange={(e) => {
                  setBrandName(e.currentTarget.value);
                  setBrandId(null);
                }}
              />
            </div>

            {/* SKU — رقم/معرّف المنتج */}
            <div className="rounded-2xl border border-zinc-200/70 bg-white/80 p-4">
              <label className="mb-1 block text-xs text-zinc-600">
                SKU (رقم/معرّف المنتج)
              </label>
              <input
                className="w-full rounded-xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm outline-none"
                placeholder="مثال: 16361-03100"
                value={sku}
                onChange={(e) => setSku(e.currentTarget.value)}
              />
              <div className="mt-1 text-[12px] text-zinc-500">
                * يُقرأ من قاعدة البيانات ويُحفظ مع تحديث المنتج.
              </div>
            </div>
          </div>

          {/* ===== وصف المنتج (TinyMCE) ===== */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/80">
            <div className="flex items-center justify-between border-b border-zinc-200/70 bg-gradient-to-l from-zinc-50 to-white px-4 py-2">
              <div className="text-sm font-bold text-zinc-700">وصف المنتج</div>
            </div>
            <div className="p-4">
              <TinymceEditor
                id="product-desc-editor"
                apiKey="qsytkn3snr04rlev0qo8rzjrf85358nf8dyfghpajv0r8l14"
                value={descHTML}
                onEditorChange={(content) => setDescHTML(content)}
                init={{
                  directionality: "rtl",
                  height: 420,
                  menubar: false,
                  statusbar: true,
                  plugins: [
                    "anchor",
                    "autolink",
                    "charmap",
                    "codesample",
                    "emoticons",
                    "image",
                    "link",
                    "lists",
                    "media",
                    "searchreplace",
                    "table",
                    "visualblocks",
                    "wordcount",
                    "checklist",
                    "mediaembed",
                    "casechange",
                    "formatpainter",
                    "pageembed",
                    "a11ychecker",
                    "tinymcespellchecker",
                    "permanentpen",
                    "powerpaste",
                    "advtable",
                    "advcode",
                    "advtemplate",
                    "mentions",
                    "tinycomments",
                    "tableofcontents",
                    "footnotes",
                    "mergetags",
                    "autocorrect",
                    "typography",
                    "inlinecss",
                    "markdown",
                    "importword",
                    "exportword",
                    "exportpdf",
                  ],
                  toolbar: [
                    "undo redo | blocks fontfamily fontsize",
                    "| bold italic underline strikethrough forecolor backcolor",
                    "| alignleft aligncenter alignright alignjustify lineheight",
                    "| checklist bullist numlist outdent indent",
                    "| link image media table advtable codesample",
                    "| addcomment showcomments a11ycheck tinymcespellchecker typography",
                    "| tableofcontents footnotes mergetags",
                    "| removeformat",
                  ].join(" "),
                  tinycomments_mode: "embedded",
                  tinycomments_author: "Author",
                  mergetags_list: [
                    { value: "First.Name", title: "First Name" },
                    { value: "Email", title: "Email" },
                  ],
                  automatic_uploads: true,
                  images_upload_handler: async (blobInfo: any) =>
                    `data:${blobInfo.blob().type};base64,${blobInfo.base64()}`,
                  convert_urls: false,
                  branding: false,
                  content_style: `
                    body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, Tajawal, Arial, "Noto Sans"; }
                    p { line-height: 1.9; }
                    img { max-width: 100%; height: auto; }
                  `,
                }}
              />
              <div className="pt-2 text-[11px] text-zinc-500">
                * يُحفظ كـ <code>products.description_html</code>.
              </div>
            </div>
          </div>

          {/* ===== الوسوم (سلة) — العرض يعتمد tagMap ===== */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/80">
            <div className="border-b border-zinc-200/70 bg-gradient-to-l from-zinc-50 to-white px-4 py-2.5 text-sm font-bold text-zinc-700">
              الوسوم (Tags)
            </div>
            <div className="space-y-4 p-4">
              {/* Chips المختارة */}
              <div className="flex flex-wrap gap-2">
                {selectedTagIds.length === 0 ? (
                  <span className="text-[12px] text-zinc-500">
                    لا توجد وسوم مضافة.
                  </span>
                ) : (
                  selectedTagIds.map((tid) => (
                    <span
                      key={tid}
                      className="group inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-sm"
                    >
                      {tagMap[tid] ?? "وسم"}
                      <button
                        aria-label="حذف الوسم"
                        className="rounded-full border border-zinc-200 px-1.5 text-zinc-500 transition hover:bg-red-50 hover:text-red-600"
                        onClick={() =>
                          setSelectedTagIds((prev) =>
                            prev.filter((id) => id !== tid)
                          )
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* إدخال أسلوب سلة */}
              <TagInput
                placeholder="ادخل الوسم هنا، ثم Enter أو زر إضافة"
                suggestions={tagOpts}
                loading={tagLoading}
                onQueryChange={(q) => setTagsQ(q)}
                onAddExisting={(id) => {
                  setSelectedTagIds((prev) =>
                    prev.includes(id) ? prev : [...prev, id]
                  );
                  const hit = tagOpts.find((s) => s.id === id);
                  if (hit) setTagMap((m) => ({ ...m, [id]: hit.name }));
                }}
                onCreateNew={async (name) => {
                  const nm = name.trim();
                  if (!nm) return;
                  try {
                    const created = await createTagByName(nm);
                    setTagOpts((prev) =>
                      prev.some((p) => p.id === created.id)
                        ? prev
                        : [...prev, created]
                    );
                    setSelectedTagIds((prev) =>
                      prev.includes(created.id) ? prev : [...prev, created.id]
                    );
                    setTagMap((m) => ({ ...m, [created.id]: created.name }));
                  } catch (err: any) {
                    alert(`تعذّر إنشاء الوسم: ${err?.message || err}`);
                  }
                }}
              />

              <div className="text-[11px] text-zinc-500">
                * تُحفظ كعلاقات في <code>product_tags(product_id, tag_id)</code>
                . الواجهة ترسل <code>tagIds</code> فقط عند تغيّرها.
              </div>
            </div>
          </div>

          {/* SEO */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/80">
            <div className="border-b border-zinc-200/70 bg-gradient-to-l from-zinc-50 to-white px-4 py-2.5 text-sm font-bold text-zinc-700">
              تحسينات SEO
            </div>
            <div className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-xs text-zinc-600">
                  العنوان التجاري المختصر
                </label>
                <input
                  className="w-full rounded-xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm outline-none"
                  value={shortTitle}
                  onChange={(e) => setShortTitle(e.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-zinc-600">
                    (Page Title) عنوان صفحة المنتج
                  </label>
                  <input
                    className="w-full rounded-xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm outline-none"
                    value={seoTitleTpl}
                    onChange={(e) => setSeoTitleTpl(e.target.value)}
                  />
                  <div className="mt-1 text-[12px] text-emerald-700 truncate">
                    {tokens(seoTitleTpl, ctx) || name}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-600">
                    (SEO Page URL) رابط صفحة المنتج
                  </label>
                  <input
                    className="w-full rounded-xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm outline-none"
                    value={seoSlugTpl}
                    onChange={(e) => setSeoSlugTpl(e.target.value)}
                  />
                  <div className="mt-1 text-[12px] text-emerald-700 truncate">
                    {slugify(tokens(seoSlugTpl, ctx) || name)}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-600">
                  (Page Description) وصف صفحة المنتج
                </label>
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm outline-none"
                  value={seoDescTpl}
                  onChange={(e) => setSeoDescTpl(e.target.value)}
                />
                <div className="mt-1 text-[12px] text-emerald-700 truncate">
                  {tokens(seoDescTpl, ctx)}
                </div>
              </div>
            </div>

            {/* شارة حالة الحفظ (اختياري للعرض) */}
            {saving || refreshingAfterSave ? (
              <div className="px-5 pt-1 text-[12px] text-zinc-500">
                يتم الحفظ والتحقق…
              </div>
            ) : lastSavedAt ? (
              <div className="px-5 pt-1 text-[12px] text-emerald-700">
                تم الحفظ عند {lastSavedAt}
              </div>
            ) : null}
          </div>

          {/* footer */}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-zinc-200/70 bg-white/80 px-4 py-2 text-sm"
            >
              إلغاء
            </button>
            <button
              onClick={saveNow}
              disabled={saving}
              className="rounded-xl bg-gradient-to-l from-teal-600 to-sky-600 px-6 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "جارٍ الحفظ…" : "حفظ بيانات المنتج"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
