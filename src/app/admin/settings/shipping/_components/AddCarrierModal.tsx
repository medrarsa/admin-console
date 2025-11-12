// src/app/admin/settings/shipping/_components/AddCarrierModal.tsx
"use client";
import * as React from "react";

type Payload = { id: string; name: string; logo?: string; active: boolean };

export default function AddCarrierModal({
  onSaved,
  onCancel,
}: {
  onSaved: (c: Payload) => void;
  onCancel: () => void;
}) {
  const [name, setName] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [supportCOD, setSupportCOD] = React.useState(true);

  // طريقة شحن افتراضية + القيود
  const [leadMin, setLeadMin] = React.useState<number | "">(2);
  const [leadMax, setLeadMax] = React.useState<number | "">(5);
  const [codFee, setCodFee] = React.useState<number | "">(7);
  const [freeThreshold, setFreeThreshold] = React.useState<number | "">("");

  // تسعير مناطق (بدون وزن)
  const [zoneA, setZoneA] = React.useState<number | "">(24);
  const [zoneB, setZoneB] = React.useState<number | "">(29);
  const [zoneC, setZoneC] = React.useState<number | "">(39);

  const save = () => {
    if (!name.trim()) return;
    // هنا لاحقًا نستدعي API لحفظ: company + method + prices + constraints
    const id = `c-${crypto.randomUUID()}`;
    onSaved({ id, name: name.trim(), active });
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save(); }}
      className="space-y-4" dir="rtl"
    >
      {/* بيانات الشركة */}
      <div className="rounded-xl border p-3 space-y-3">
        <div className="font-medium">بيانات الشركة</div>
        <label className="block">
          <div className="mb-1 text-sm">اسم الشركة</div>
          <input
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Naqel / Aramex / SMSA ..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={active} onChange={(e)=>setActive(e.target.checked)} />
            <span>فعّالة</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={supportCOD} onChange={(e)=>setSupportCOD(e.target.checked)} />
            <span>تدعم الدفع عند الاستلام</span>
          </label>
        </div>
      </div>

      {/* طريقة الشحن + القيود */}
      <div className="rounded-xl border p-3 space-y-3">
        <div className="font-medium">طريقة الشحن والقيود (بدون وزن)</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="block">
            <div className="mb-1 text-sm">المدة (أقل)</div>
            <input className="w-full rounded-lg border px-2 py-1 text-left"
              type="number" value={leadMin as number | undefined}
              onChange={(e)=>setLeadMin(e.target.value === "" ? "" : Number(e.target.value))}/>
          </label>
          <label className="block">
            <div className="mb-1 text-sm">المدة (أعلى)</div>
            <input className="w-full rounded-lg border px-2 py-1 text-left"
              type="number" value={leadMax as number | undefined}
              onChange={(e)=>setLeadMax(e.target.value === "" ? "" : Number(e.target.value))}/>
          </label>
          <label className="block">
            <div className="mb-1 text-sm">رسوم COD</div>
            <input className="w-full rounded-lg border px-2 py-1 text-left"
              type="number" disabled={!supportCOD}
              value={codFee as number | undefined}
              onChange={(e)=>setCodFee(e.target.value === "" ? "" : Number(e.target.value))}/>
          </label>
          <label className="block">
            <div className="mb-1 text-sm">مجاني فوق</div>
            <input className="w-full rounded-lg border px-2 py-1 text-left"
              type="number" value={freeThreshold as number | undefined}
              onChange={(e)=>setFreeThreshold(e.target.value === "" ? "" : Number(e.target.value))}/>
          </label>
        </div>

        {/* تسعير المناطق */}
        <div className="grid gap-2">
          <RowZone code="A — مدن رئيسية" value={zoneA} onChange={setZoneA}/>
          <RowZone code="B — مدن متوسطة" value={zoneB} onChange={setZoneB}/>
          <RowZone code="C — مناطق نائية" value={zoneC} onChange={setZoneC}/>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="rounded-xl px-4 py-2 border" onClick={onCancel}>إلغاء</button>
        <button type="submit" className="rounded-xl px-4 py-2 bg-zinc-900 text-white">حفظ</button>
      </div>
    </form>
  );
}

function RowZone({
  code,
  value,
  onChange,
}: {
  code: string;
  value: number | "";
  onChange: (v: number | "") => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border p-3">
      <span className="font-medium">{code}</span>
      <span className="flex items-center gap-2">
        <input
          className="w-24 rounded-lg border px-2 py-1 text-left"
          type="number"
          value={value as number | undefined}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        />
        <span className="text-sm text-zinc-600">رس</span>
      </span>
    </label>
  );
}
