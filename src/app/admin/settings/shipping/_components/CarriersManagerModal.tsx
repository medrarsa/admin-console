"use client";
import * as React from "react";

/** نوع الشركة */
type Carrier = {
  id: string;
  name: string;
  is_active: boolean;
  support_cod: boolean;
  logo?: string | null;
};

/** نوع الطريقة (مختصر – سننقله später لمودال مستقل إن حبيت) */
type Method = {
  id: string;
  carrier_id: string;
  name: string;
  is_active: boolean;
  allow_cod: boolean;
  lead_min?: number | null;
  lead_max?: number | null;
};

/** تسعير مناطق بدون وزن */
type ZonePrice = {
  id: string;
  method_id: string;
  zone_code: "A" | "B" | "C";
  fee: number;
};

export default function CarriersManagerModal({ onClose }: { onClose: () => void }) {
  /** داتا مبدئية */
  const [carriers, setCarriers] = React.useState<Carrier[]>([
    { id: "c-naqel", name: "Naqel", is_active: true, support_cod: true },
    { id: "c-aramex", name: "Aramex", is_active: true, support_cod: false },
    { id: "c-smsa", name: "SMSA", is_active: true, support_cod: true },
    { id: "c-spl", name: "SPL", is_active: true, support_cod: false },
    { id: "c-jt", name: "J&T", is_active: true, support_cod: true },
  ]);

  const [methods, setMethods] = React.useState<Method[]>([
    { id: "m-naqel", carrier_id: "c-naqel", name: "باب لباب", is_active: true, allow_cod: true, lead_min: 2, lead_max: 5 },
    { id: "m-aramex", carrier_id: "c-aramex", name: "إكسبرس", is_active: true, allow_cod: false, lead_min: 2, lead_max: 4 },
  ]);

  const [zonePrices, setZonePrices] = React.useState<ZonePrice[]>([
    { id: "p-1", method_id: "m-naqel", zone_code: "A", fee: 24 },
    { id: "p-2", method_id: "m-naqel", zone_code: "B", fee: 29 },
    { id: "p-3", method_id: "m-naqel", zone_code: "C", fee: 39 },
    { id: "p-4", method_id: "m-aramex", zone_code: "A", fee: 26 },
    { id: "p-5", method_id: "m-aramex", zone_code: "B", fee: 32 },
    { id: "p-6", method_id: "m-aramex", zone_code: "C", fee: 45 },
  ]);

  /** UI state */
  const [editing, setEditing] = React.useState<Carrier | null>(null);
  const [openMethodsFor, setOpenMethodsFor] = React.useState<Carrier | null>(null);
  const [openPricesFor, setOpenPricesFor] = React.useState<Method | null>(null);
  const [openConstraintsFor, setOpenConstraintsFor] = React.useState<Method | null>(null);

  /** أدوات بسيطة */
  const upsertCarrier = (c: Carrier) => {
    setCarriers((xs) => {
      const i = xs.findIndex((x) => x.id === c.id);
      if (i >= 0) {
        const copy = xs.slice();
        copy[i] = c;
        return copy;
      }
      return [...xs, c];
    });
  };

  const removeCarrier = (id: string) => {
    setCarriers((xs) => xs.filter((x) => x.id !== id));
    setMethods((ms) => ms.filter((m) => m.carrier_id !== id));
  };

  const methodsOf = (carrierId: string) => methods.filter((m) => m.carrier_id === carrierId);

  const upsertMethod = (m: Method) => {
    setMethods((xs) => {
      const i = xs.findIndex((x) => x.id === m.id);
      if (i >= 0) {
        const copy = xs.slice();
        copy[i] = m;
        return copy;
      }
      return [...xs, m];
    });
  };

  const pricesOf = (methodId: string) => zonePrices.filter((p) => p.method_id === methodId);

  const upsertPrice = (p: ZonePrice) => {
    setZonePrices((xs) => {
      const i = xs.findIndex((x) => x.id === p.id);
      if (i >= 0) {
        const copy = xs.slice();
        copy[i] = p;
        return copy;
      }
      return [...xs, p];
    });
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-500">
          أضف شركات الشحن ثم افتح “الطرق” لتعريف التسعير والقيود (بدون وزن).
        </div>
        <button
          className="rounded-xl px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={() =>
            setEditing({
              id: crypto.randomUUID(),
              name: "",
              is_active: true,
              support_cod: false,
              logo: null,
            })
          }
        >
          + إضافة شركة
        </button>
      </div>

      {/* قائمة الشركات */}
      <div className="grid md:grid-cols-2 gap-3">
        {carriers.map((c) => (
          <div key={c.id} className="rounded-2xl border p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl border grid place-items-center text-sm">{c.logo ? <img src={c.logo} alt="" /> : c.name[0]}</div>
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-zinc-500">
                  {c.support_cod ? "يدعم الدفع عند الاستلام" : "بدون COD"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-lg px-3 py-1.5 border hover:bg-zinc-50" onClick={() => setOpenMethodsFor(c)}>
                الطرق
              </button>
              <button className="rounded-lg px-3 py-1.5 border hover:bg-zinc-50" onClick={() => setEditing(c)}>
                تعديل
              </button>
              <button className="rounded-lg px-3 py-1.5 border text-red-600 hover:bg-red-50" onClick={() => removeCarrier(c.id)}>
                حذف
              </button>
              <button
                className={`rounded-lg px-3 py-1.5 border ${c.is_active ? "bg-emerald-50 border-emerald-200 text-emerald-700" : ""}`}
                onClick={() => upsertCarrier({ ...c, is_active: !c.is_active })}
              >
                {c.is_active ? "معطّل" : "تفعيل"}
              </button>
            </div>
          </div>
        ))}
        {carriers.length === 0 && <div className="text-sm text-zinc-500">لا توجد شركات بعد.</div>}
      </div>

      {/* مودال تحرير/إضافة شركة */}
      {editing && (
        <InnerDialog title={editing.name ? "تعديل شركة" : "إضافة شركة"} onClose={() => setEditing(null)}>
          <CarrierForm
            value={editing}
            onCancel={() => setEditing(null)}
            onSave={(v) => {
              if (!v.name.trim()) return;
              upsertCarrier(v);
              setEditing(null);
            }}
          />
        </InnerDialog>
      )}

      {/* مودال طرق الشحن الخاصة بشركة */}
      {openMethodsFor && (
        <InnerDialog title={`طرق الشحن — ${openMethodsFor.name}`} onClose={() => setOpenMethodsFor(null)}>
          <MethodsPanel
            carrier={openMethodsFor}
            methods={methodsOf(openMethodsFor.id)}
            onAdd={() =>
              upsertMethod({
                id: crypto.randomUUID(),
                carrier_id: openMethodsFor.id,
                name: "طريقة جديدة",
                is_active: true,
                allow_cod: openMethodsFor.support_cod,
                lead_min: 2,
                lead_max: 5,
              })
            }
            onUpdate={(m) => upsertMethod(m)}
            onOpenPrices={(m) => setOpenPricesFor(m)}
            onOpenConstraints={(m) => setOpenConstraintsFor(m)}
          />
        </InnerDialog>
      )}

      {/* مودال تسعير المناطق */}
      {openPricesFor && (
        <InnerDialog title={`تسعير المناطق — ${openPricesFor.name}`} onClose={() => setOpenPricesFor(null)}>
          <ZonePricesPanel
            method={openPricesFor}
            prices={pricesOf(openPricesFor.id)}
            onSave={(p) => upsertPrice(p)}
          />
        </InnerDialog>
      )}

      {/* مودال القيود (مختصر) */}
      {openConstraintsFor && (
        <InnerDialog title={`القيود — ${openConstraintsFor.name}`} onClose={() => setOpenConstraintsFor(null)}>
          <ConstraintsPanel
            method={openConstraintsFor}
            onClose={() => setOpenConstraintsFor(null)}
          />
        </InnerDialog>
      )}

      <div className="flex justify-end pt-2">
        <button className="rounded-xl px-4 py-2 border" onClick={onClose}>إغلاق</button>
      </div>
    </div>
  );
}

/* ---------------- Sub Components ---------------- */

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
      <div className="w-full max-w-3xl rounded-2xl bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{title}</h3>
          <button className="text-zinc-500" onClick={onClose}>إغلاق</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CarrierForm({
  value,
  onSave,
  onCancel,
}: {
  value: Carrier;
  onSave: (v: Carrier) => void;
  onCancel: () => void;
}) {
  const [v, setV] = React.useState<Carrier>(value);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v);
      }}
    >
      <label className="block">
        <div className="mb-1 text-sm">اسم الشركة</div>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={v.name}
          onChange={(e) => setV({ ...v, name: e.target.value })}
          placeholder="Naqel / Aramex / SMSA ..."
        />
      </label>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={v.is_active}
            onChange={(e) => setV({ ...v, is_active: e.target.checked })}
          />
          <span>فعّال</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={v.support_cod}
            onChange={(e) => setV({ ...v, support_cod: e.target.checked })}
          />
          <span>يدعم الدفع عند الاستلام</span>
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="rounded-xl px-4 py-2 border" onClick={onCancel}>
          إلغاء
        </button>
        <button type="submit" className="rounded-xl px-4 py-2 bg-zinc-900 text-white">
          حفظ
        </button>
      </div>
    </form>
  );
}

function MethodsPanel({
  carrier,
  methods,
  onAdd,
  onUpdate,
  onOpenPrices,
  onOpenConstraints,
}: {
  carrier: Carrier;
  methods: Method[];
  onAdd: () => void;
  onUpdate: (m: Method) => void;
  onOpenPrices: (m: Method) => void;
  onOpenConstraints: (m: Method) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button className="rounded-xl px-3 py-1.5 bg-emerald-600 text-white" onClick={onAdd}>
          + إضافة طريقة
        </button>
      </div>
      {methods.map((m) => (
        <div key={m.id} className="rounded-xl border p-3 flex items-center justify-between">
          <div>
            <div className="font-medium">{m.name}</div>
            <div className="text-xs text-zinc-500">
              المدة: {m.lead_min ?? "-"}–{m.lead_max ?? "-"} أيام • {m.allow_cod ? "يدعم COD" : "بدون COD"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-lg px-3 py-1.5 border hover:bg-zinc-50" onClick={() => onOpenPrices(m)}>
              تسعير المناطق
            </button>
            <button className="rounded-lg px-3 py-1.5 border hover:bg-zinc-50" onClick={() => onOpenConstraints(m)}>
              القيود
            </button>
            <button
              className={`rounded-lg px-3 py-1.5 border ${m.is_active ? "bg-emerald-50 border-emerald-200 text-emerald-700" : ""}`}
              onClick={() => onUpdate({ ...m, is_active: !m.is_active })}
            >
              {m.is_active ? "معطّل" : "تفعيل"}
            </button>
          </div>
        </div>
      ))}
      {methods.length === 0 && <div className="text-sm text-zinc-500">لا توجد طرق لهذه الشركة بعد.</div>}
    </div>
  );
}

function ZonePricesPanel({
  method,
  prices,
  onSave,
}: {
  method: Method;
  prices: ZonePrice[];
  onSave: (p: ZonePrice) => void;
}) {
  /** تأكد وجود A/B/C دائماً */
  const ensureRow = (code: ZonePrice["zone_code"], fee: number) => {
    const row = prices.find((x) => x.zone_code === code);
    if (!row) {
      const newRow: ZonePrice = { id: crypto.randomUUID(), method_id: method.id, zone_code: code, fee };
      onSave(newRow);
    }
  };
  React.useEffect(() => {
    ensureRow("A", 24);
    ensureRow("B", 29);
    ensureRow("C", 39);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = (["A", "B", "C"] as const).map((z) => prices.find((p) => p.zone_code === z));

  return (
    <div className="space-y-2">
      {rows.map((r, i) => {
        const code = (["A", "B", "C"] as const)[i];
        const current = r ?? { id: crypto.randomUUID(), method_id: method.id, zone_code: code, fee: 0 };
        return (
          <div key={code} className="rounded-xl border p-3 flex items-center justify-between">
            <div className="font-medium">{code} — {code === "A" ? "مدن رئيسية" : code === "B" ? "مدن متوسطة" : "مناطق نائية"}</div>
            <div className="flex items-center gap-2">
              <input
                className="w-24 rounded-lg border px-2 py-1 text-left"
                type="number"
                value={current.fee}
                onChange={(e) => onSave({ ...current, fee: Number(e.target.value || 0) })}
              />
              <span className="text-sm text-zinc-600">رس</span>
            </div>
          </div>
        );
      })}
      <div className="flex justify-end pt-2">
        <span className="text-xs text-zinc-500">* تسعير ثابت بدون وزن.</span>
      </div>
    </div>
  );
}

function ConstraintsPanel({ method, onClose }: { method: Method; onClose: () => void }) {
  const [free, setFree] = React.useState<number | "">(method.name.includes("إكسبرس") ? 300 : "");
  const [codFee, setCodFee] = React.useState<number | "">(method.allow_cod ? 7 : "");
  const [minOrder, setMinOrder] = React.useState<number | "">("");
  const [maxOrder, setMaxOrder] = React.useState<number | "">("");

  return (
    <div className="space-y-3">
      <div className="grid gap-3">
        <label className="flex items-center justify-between rounded-xl border p-3">
          <span>الشحن مجاني فوق</span>
          <div className="flex items-center gap-2">
            <input
              className="w-28 rounded-lg border px-2 py-1 text-left"
              value={free}
              onChange={(e) => setFree(e.target.value === "" ? "" : Number(e.target.value))}
            />
            <span className="text-sm text-zinc-600">رس</span>
          </div>
        </label>

        <label className="flex items-center justify-between rounded-xl border p-3">
          <span>رسوم الدفع عند الاستلام</span>
          <div className="flex items-center gap-2">
            <input
              className="w-28 rounded-lg border px-2 py-1 text-left"
              value={codFee}
              onChange={(e) => setCodFee(e.target.value === "" ? "" : Number(e.target.value))}
              disabled={!method.allow_cod}
            />
            <span className="text-sm text-zinc-600">رس</span>
          </div>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center justify-between rounded-xl border p-3">
            <span>حد أدنى للطلب</span>
            <input
              className="w-28 rounded-lg border px-2 py-1 text-left"
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border p-3">
            <span>حد أقصى للطلب</span>
            <input
              className="w-28 rounded-lg border px-2 py-1 text-left"
              value={maxOrder}
              onChange={(e) => setMaxOrder(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button className="rounded-xl px-4 py-2 border" onClick={onClose}>إغلاق</button>
        <button className="rounded-xl px-4 py-2 bg-zinc-900 text-white" onClick={onClose}>حفظ</button>
      </div>
    </div>
  );
}
