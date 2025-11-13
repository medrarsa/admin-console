// src/app/admin/settings/shipping/_components/CarriersManagerModal.tsx
"use client";
import * as React from "react";
import CountryCityPricingModal from "./CountryCityPricingModal";

/* ======================= Types ======================= */
type Method = {
  id: string;
  carrier_id: string;
  name: string;
  is_active: boolean;
  allow_cod: boolean;
  lead_min?: number | null;
  lead_max?: number | null;
};

/* ================= CarriersManagerModal =================
   - يستقبل carrierId (اختياري) لعرض طرق الشحن الخاصة بالشركة مباشرة
   - زر "تسعير المدن" يفتح CountryCityPricingModal ويمرر methodId
========================================================= */
export default function CarriersManagerModal({
  carrierId,
  onClose,
}: {
  carrierId?: string;
  onClose: () => void;
}) {
  const [methods, setMethods] = React.useState<Method[]>([]);
  const [loading, setLoading] = React.useState(true);

  // فتح تسعير المدن لطريقة معيّنة
  const [countryPricingFor, setCountryPricingFor] = React.useState<null | {
    methodId: string;
    methodName: string;
  }>(null);

  const loadMethods = React.useCallback(async () => {
    setLoading(true);
    try {
      const url = carrierId
        ? `/api/admin/shipping/methods?carrier_id=${carrierId}`
        : `/api/admin/shipping/methods`;
      const r = await fetch(url, { cache: "no-store" }).then((x) => x.json());
      setMethods(Array.isArray(r?.data) ? r.data : []);
    } finally {
      setLoading(false);
    }
  }, [carrierId]);

  React.useEffect(() => {
    loadMethods();
  }, [loadMethods]);

  const createMethod = async () => {
    if (!carrierId) return;
    const body = {
      company_id: carrierId,
      name: "طريقة جديدة",
      allow_cod: false,
      lead_min: 2,
      lead_max: 5,
    };
    const r = await fetch("/api/admin/shipping/methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((x) => x.json());
    if (r?.success && r.data) setMethods((xs) => [r.data, ...xs]);
  };

  const toggleMethod = async (m: Method) => {
    // تبديل محلي (إن أردت PATCH فعلي لاحقًا أضف route)
    setMethods((xs) =>
      xs.map((x) => (x.id === m.id ? { ...x, is_active: !x.is_active } : x))
    );
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="text-sm text-zinc-500">
        طرق الشحن للشركة المختارة (مباشرة).
      </div>

      <div className="flex justify-end">
        {carrierId && (
          <button
            className="rounded-xl px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={createMethod}
          >
            + إضافة طريقة
          </button>
        )}
      </div>

      {/* قائمة الطرق */}
      <div className="space-y-2">
        {loading ? (
          <div className="rounded-xl border p-4 animate-pulse bg-zinc-50" />
        ) : (
          (methods ?? []).map((m) => (
            <div
              key={m.id}
              className="rounded-xl border p-3 flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{m.name}</div>
                <div className="text-xs text-zinc-500">
                  المدة: {m.lead_min ?? "-"}–{m.lead_max ?? "-"} أيام •{" "}
                  {m.allow_cod ? "يدعم COD" : "بدون COD"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg px-3 py-1.5 border hover:bg-zinc-50"
                  onClick={() =>
                    setCountryPricingFor({ methodId: m.id, methodName: m.name })
                  }
                >
                  تسعير المدن
                </button>
                <button
                  className={`rounded-lg px-3 py-1.5 border ${
                    m.is_active
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : ""
                  }`}
                  onClick={() => toggleMethod(m)}
                >
                  {m.is_active ? "تعطيل" : "تفعيل"}
                </button>
              </div>
            </div>
          ))
        )}
        {!loading && (!methods || methods.length === 0) && (
          <div className="text-sm text-zinc-500">
            لا توجد طرق بعد لهذه الشركة.
          </div>
        )}
      </div>

      {/* مودال داخلي: اختيار بلد → مدن → تسعير للمدن المختارة */}
      {countryPricingFor && (
        <InnerDialog
          title={`تسعير المدن — ${countryPricingFor.methodName}`}
          onClose={() => setCountryPricingFor(null)}
        >
          <CountryCityPricingModal
            methodId={countryPricingFor.methodId}
            onClose={() => setCountryPricingFor(null)}
          />
        </InnerDialog>
      )}

      <div className="flex justify-end pt-2">
        <button className="rounded-xl px-4 py-2 border" onClick={onClose}>
          إغلاق
        </button>
      </div>
    </div>
  );
}

/* ================= Inner Dialog Wrapper ================= */
function InnerDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{title}</h3>
          <button className="text-zinc-500" onClick={onClose}>
            إغلاق
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
