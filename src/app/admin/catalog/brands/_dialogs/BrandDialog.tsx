"use client";

import * as React from "react";

/* ===== Types ===== */
type SEO = {
  slug?: string;
  meta_title?: string | null;
  meta_description?: string | null;
  is_active?: boolean;
};

export type Brand = {
  id?: string;
  name: string;
  description?: string | null;
  logo?: string | null;
  banner?: string | null;
  ar_char?: string | null;
  en_char?: string | null;
  is_active: boolean;
  seo?: SEO | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initial?: Brand | null;
  onSaved?: () => void;
};

/* ===== API (DB) ===== */
async function createBrand(payload: Brand) {
  const res = await fetch("/api/admin/brands", {
    method: "POST",
    headers: { "content-type": "application/json", "x-app-role": "admin" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function updateBrand(id: string, payload: Brand) {
  const res = await fetch(`/api/admin/brands/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-app-role": "admin" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ===== Upload Local (immediate) ===== */
function slugify(s: string) {
  return s.toString().trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
}
async function uploadViaLocalServer(file: File, keyPrefix: string, kind: "logo" | "banner") {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("keyPrefix", keyPrefix);
  fd.append("kind", kind);

  const res = await fetch("/api/admin/uploads/brand", {
    method: "POST",
    headers: { "x-app-role": "admin" },
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return json.url as string; // /image/catalog/brands/<prefix>/<file>
}

export default function BrandDialog({ open, onClose, initial, onSaved }: Props) {
  const isEdit = Boolean(initial?.id);

  const [form, setForm] = React.useState<Brand>({
    id: initial?.id,
    name: initial?.name || "",
    description: initial?.description || "",
    logo: initial?.logo || "",
    banner: initial?.banner || "",
    ar_char: initial?.ar_char || "",
    en_char: initial?.en_char || "",
    is_active: initial?.is_active ?? true,
    seo: initial?.seo ?? { slug: "", meta_title: "", meta_description: "", is_active: true },
  });

  React.useEffect(() => {
    if (open) {
      setForm({
        id: initial?.id,
        name: initial?.name || "",
        description: initial?.description || "",
        logo: initial?.logo || "",
        banner: initial?.banner || "",
        ar_char: initial?.ar_char || "",
        en_char: initial?.en_char || "",
        is_active: initial?.is_active ?? true,
        seo: initial?.seo
          ? {
              slug: initial.seo.slug || "",
              meta_title: initial.seo.meta_title || "",
              meta_description: initial.seo.meta_description || "",
              is_active: initial.seo.is_active ?? true,
            }
          : { slug: "", meta_title: "", meta_description: "", is_active: true },
      });
    }
  }, [open, initial]);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [upLogo, setUpLogo] = React.useState(false);
  const [upBanner, setUpBanner] = React.useState(false);

  const logoInputRef = React.useRef<HTMLInputElement | null>(null);
  const bannerInputRef = React.useRef<HTMLInputElement | null>(null);

  const onChange = (k: keyof Brand, v: any) => setForm((s) => ({ ...s, [k]: v }));
  const onSEOChange = (k: keyof SEO, v: any) => setForm((s) => ({ ...s, seo: { ...(s.seo ?? {}), [k]: v } }));

  const handleNameChange = (value: string) => {
    onChange("name", value);
    // تعبئة تلقائية للـ slug والحروف إن كانت فاضية
    if (!form.seo?.slug) onSEOChange("slug", slugify(value));
    if (!form.ar_char) onChange("ar_char", value.trim()[0] || "");
    if (!form.en_char) onChange("en_char", (value.trim()[0] || "").toUpperCase());
  };

  // رفع فوري للشعار
  const onPickLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUpLogo(true);
    try {
      const keyPrefix = slugify(form.seo?.slug || form.name || "brand") || "brand";
      const url = await uploadViaLocalServer(file, keyPrefix, "logo");
      onChange("logo", url); // ✅ اعرض من المسار النهائي فورًا
    } catch (err: any) {
      setError(err?.message || "فشل رفع الشعار");
    } finally {
      setUpLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = ""; // نظّف الاختيار
    }
  };

  // رفع فوري للبانر
  const onPickBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUpBanner(true);
    try {
      const keyPrefix = slugify(form.seo?.slug || form.name || "brand") || "brand";
      const url = await uploadViaLocalServer(file, keyPrefix, "banner");
      onChange("banner", url); // ✅ اعرض من المسار النهائي فورًا
    } catch (err: any) {
      setError(err?.message || "فشل رفع البانر");
    } finally {
      setUpBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = "";
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Brand = { ...form };

      // لو slug فاضي لا نرسل seo (تجنّب خطأ Zod)
      if (!payload.seo?.slug || payload.seo.slug.trim() === "") {
        delete (payload as any).seo;
      }

      if (isEdit && form.id) {
        await updateBrand(form.id, payload);
      } else {
        await createBrand(payload);
      }

      setSaving(false);
      onClose();
      onSaved?.();
    } catch (err: any) {
      setSaving(false);
      setError(err?.message || "فشل الحفظ");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div className="w-[min(900px,96vw)] max-h-[90vh] overflow-auto rounded-2xl bg-white p-4 md:p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{isEdit ? "تعديل ماركة" : "إضافة ماركة جديدة"}</h3>
          <button onClick={onClose} className="rounded-lg border px-3 py-1.5">إغلاق</button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          {/* الصور */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm">صورة البانر (1280×300)</label>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                onChange={onPickBanner}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
              <div className="mt-2 min-h-[60px]">
                {upBanner ? (
                  <div className="text-sm text-gray-500">يتم الرفع…</div>
                ) : form.banner ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.banner} alt="banner" className="w-full rounded-xl border" />
                ) : (
                  <div className="text-xs text-gray-400">لم يتم اختيار بانر بعد</div>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm">شعار الماركة (100×80)</label>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={onPickLogo}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
              <div className="mt-2 min-h-[60px]">
                {upLogo ? (
                  <div className="text-sm text-gray-500">يتم الرفع…</div>
                ) : form.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logo} alt="logo" className="h-20 object-contain rounded-xl border" />
                ) : (
                  <div className="text-xs text-gray-400">لم يتم اختيار شعار بعد</div>
                )}
              </div>
            </div>
          </div>

          {/* بيانات أساسية */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm">اسم الماركة *</label>
              <input
                required
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="مثال: تويوتا"
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm">حرف عربي</label>
                <input
                  value={form.ar_char || ""}
                  onChange={(e) => onChange("ar_char", e.target.value)}
                  maxLength={2}
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                />
              </div>
              <div>
                <label className="text-sm">حرف إنجليزي</label>
                <input
                  value={form.en_char || ""}
                  onChange={(e) => onChange("en_char", e.target.value)}
                  maxLength={2}
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => onChange("is_active", e.target.checked)}
                    className="size-4"
                  />
                  <span className="text-sm">مفعّل</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm">وصف مختصر</label>
            <textarea
              value={form.description || ""}
              onChange={(e) => onChange("description", e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border px-3 py-2"
            />
          </div>

          {/* SEO */}
          <div className="rounded-2xl border p-3 md:p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">تحسينات SEO</h4>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.seo?.is_active ?? true}
                  onChange={(e) => onSEOChange("is_active", e.target.checked)}
                />
                <span className="text-sm">تفعيل صفحة الماركة</span>
              </label>
            </div>
            <div className="grid md:grid-cols-2 gap-4 mt-3">
              <div>
                <label className="text-sm">رابط الصفحة (Slug)</label>
                <input
                  value={form.seo?.slug || ""}
                  onChange={(e) => onSEOChange("slug", e.target.value)}
                  placeholder="مثال: toyota"
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                />
              </div>
              <div>
                <label className="text-sm">عنوان الصفحة (Page Title)</label>
                <input
                  value={form.seo?.meta_title || ""}
                  onChange={(e) => onSEOChange("meta_title", e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm">وصف الصفحة (Page Description)</label>
                <textarea
                  value={form.seo?.meta_description || ""}
                  onChange={(e) => onSEOChange("meta_description", e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              مثال للرابط: /{form.seo?.slug || "<slug>"}
            </p>
          </div>

          {error ? <div className="text-red-600 text-sm">{error}</div> : null}

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2">إلغاء</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 text-white px-4 py-2 disabled:opacity-50">
              {saving ? "جارٍ الحفظ..." : isEdit ? "حفظ" : "إضافة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
