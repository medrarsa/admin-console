"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

type Mode = "create" | "edit";

export type Initial = {
  /** مهم للتعديل: نرسله للـ PATCH. بالإنشاء اتركه فارغ */
  promotion_id?: string;
  /** ممكن يكون id الكوبون (اختياري للعرض فقط) */
  id?: string;

  kind: "coupon";
  status: "active" | "paused" | "expired" | "scheduled" | string;
  name: string;
  channels: string[]; // ['web','app'] إلخ
  min_subtotal: number | null;
  once_per_order: boolean;
  usage_limit: number | null;
  per_customer_limit: number | null;
  starts_at: string | null; // ISO string
  ends_at: string | null; // ISO string
  free_shipping?: boolean; // ✅

  config: {
    discount_type: "percent" | "amount";
    value: number; // percent=نسبة (0..100) | amount=مبلغ
    max_discount?: number | null; // سقف الخصم (اختياري)
    code: string; // كود الكوبون
  };
};

export default function PromoForm({
  mode,
  initial,
}: {
  mode: Mode;
  initial: Initial;
}) {
  const [form, setForm] = React.useState<Initial>(initial);
  const [submitting, setSubmitting] = React.useState(false);
  const router = useRouter();

  const set = <K extends keyof Initial>(k: K, v: Initial[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const setCfg = <K extends keyof Initial["config"]>(
    k: K,
    v: Initial["config"][K]
  ) => setForm((s) => ({ ...s, config: { ...s.config, [k]: v } }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      // لا PATCH إلا لو عندنا promotion_id حقيقي
      const patchId = form.promotion_id ?? initial.promotion_id ?? undefined;
      const isCreate = mode === "create" || !patchId;

      const url = isCreate
        ? "/api/admin/marketing_tools/promotions"
        : `/api/admin/marketing_tools/promotions/${patchId}`;

      const method = isCreate ? "POST" : "PATCH";

      // تأمينات بسيطة
      const payload = {
        ...form,
        kind: "coupon" as const,
        channels:
          Array.isArray(form.channels) && form.channels.length
            ? form.channels
            : ["web"],
        config: {
          ...form.config,
          code: String(form.config.code || "").trim(),
          discount_type:
            form.config.discount_type === "percent" ? "percent" : "amount",
          value: Number(form.config.value || 0),
          max_discount:
            form.config.max_discount === null ||
            form.config.max_discount === undefined
              ? null
              : Number(form.config.max_discount),
        },
        min_subtotal:
          form.min_subtotal === null || form.min_subtotal === undefined
            ? null
            : Number(form.min_subtotal),
        usage_limit:
          form.usage_limit === null || form.usage_limit === undefined
            ? null
            : Number(form.usage_limit),
        per_customer_limit:
          form.per_customer_limit === null ||
          form.per_customer_limit === undefined
            ? null
            : Number(form.per_customer_limit),
        free_shipping: !!form.free_shipping,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("API error:", res.status, txt);
        alert(`فشل الحفظ (${res.status}).`);
        setSubmitting(false);
        return;
      }

      // تحديت القائمة (اختياري): لو عندك مستمع في الصفحة
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("coupons:changed"));
      }

      router.back(); // يقفل المودال
    } catch (err) {
      console.error(err);
      alert("فشل الاتصال بالخادم (Network).");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* العمود الأيمن: بيانات الكوبون */}
        <div className="rounded-2xl border p-4 bg-white space-y-4">
          <h3 className="font-semibold">بيانات الكوبون</h3>

          <Field label="كود الكوبون">
            <input
              value={form.config.code}
              onChange={(e) => setCfg("code", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="(حروف انجليزية وأرقام بدون مسافات)"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="نوع الخصم للعميل">
              <select
                value={form.config.discount_type}
                onChange={(e) => setCfg("discount_type", e.target.value as any)}
                className="w-full rounded-xl border px-3 py-2"
              >
                <option value="amount">مبلغ ثابت</option>
                <option value="percent">نسبة %</option>
              </select>
            </Field>

            <Field
              label={
                form.config.discount_type === "percent" ? "النسبة %" : "المبلغ"
              }
            >
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.config.value}
                onChange={(e) => setCfg("value", Number(e.target.value))}
                className="w-full rounded-xl border px-3 py-2"
                required
              />
            </Field>
          </div>

          <Field label="سقف الخصم (اختياري)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.config.max_discount ?? 0}
              onChange={(e) =>
                setCfg(
                  "max_discount",
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
              className="w-full rounded-xl border px-3 py-2"
              placeholder="اتركه فارغًا لو بدون سقف"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="بداية">
              <input
                type="datetime-local"
                value={localDT(form.starts_at)}
                onChange={(e) => set("starts_at", toIsoOrNull(e.target.value))}
                className="w-full rounded-xl border px-3 py-2"
              />
            </Field>
            <Field label="انتهاء">
              <input
                type="datetime-local"
                value={localDT(form.ends_at)}
                onChange={(e) => set("ends_at", toIsoOrNull(e.target.value))}
                className="w-full rounded-xl border px-3 py-2"
              />
            </Field>
          </div>

          <Field label="الحالة">
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
            >
              <option value="active">مفعل</option>
              <option value="paused">موقّف</option>
              <option value="scheduled">مجدول</option>
            </select>
          </Field>

          {/* ✅ مع شحن مجاني ؟ */}
          <label className="flex items-center justify-between rounded-xl border p-3 cursor-pointer">
            <div className="flex items-center gap-2">
              <span className="text-sm">مع شحن مجاني ؟</span>
              <span className="text-zinc-400 text-xs">🚚</span>
            </div>
            <input
              type="checkbox"
              checked={!!form.free_shipping}
              onChange={(e) => set("free_shipping", e.target.checked)}
            />
          </label>
        </div>

        {/* العمود الأيسر: الشروط */}
        <div className="rounded-2xl border p-4 bg-white space-y-4">
          <h3 className="font-semibold">شروط الكوبون</h3>

          <Field label="الحد الأدنى (غير شامل الضريبة)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.min_subtotal ?? 0}
              onChange={(e) =>
                set(
                  "min_subtotal",
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
              className="w-full rounded-xl border px-3 py-2"
              placeholder="اتركه فارغًا لو بدون حد أدنى"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="مرات الاستخدام للجميع">
              <input
                type="number"
                min={0}
                value={form.usage_limit ?? 0}
                onChange={(e) =>
                  set(
                    "usage_limit",
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
                className="w-full rounded-xl border px-3 py-2"
                placeholder="0 = غير محدود"
              />
            </Field>
            <Field label="مرات الاستخدام للعميل الواحد">
              <input
                type="number"
                min={0}
                value={form.per_customer_limit ?? 0}
                onChange={(e) =>
                  set(
                    "per_customer_limit",
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
                className="w-full rounded-xl border px-3 py-2"
                placeholder="0 = غير محدود"
              />
            </Field>
          </div>

          <Field label="القنوات">
            <div className="flex gap-3">
              {["web", "app"].map((c) => {
                const checked = form.channels.includes(c);
                return (
                  <label key={c} className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        set(
                          "channels",
                          checked
                            ? form.channels.filter((x) => x !== c)
                            : [...form.channels, c]
                        )
                      }
                    />
                    <span className="text-sm">
                      {c === "web" ? "الويب" : "التطبيق"}
                    </span>
                  </label>
                );
              })}
            </div>
          </Field>

          <label className="flex items-center justify-between rounded-xl border p-3 cursor-pointer">
            <div>
              <div className="font-medium">تطبيق مرة واحدة لكل طلب؟</div>
              <div className="text-xs text-zinc-500">
                يمنع تكرار نفس الكوبون داخل الطلب.
              </div>
            </div>
            <input
              type="checkbox"
              checked={form.once_per_order}
              onChange={(e) => set("once_per_order", e.target.checked)}
            />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-6 py-2"
        >
          {submitting ? "يحفظ..." : "حفظ"}
        </button>
      </div>
    </form>
  );
}

/* ---------- Helpers ---------- */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <div className="text-sm text-zinc-600">{label}</div>
      {children}
    </label>
  );
}

function toIsoOrNull(v: string) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function localDT(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}
