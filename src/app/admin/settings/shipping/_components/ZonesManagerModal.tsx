"use client";
import * as React from "react";

type Zone = { id: string; code: "A" | "B" | "C" | string; name: string };
type City = { id: string; name: string };
type ZoneCities = Record<string, City[]>; // zoneId -> cities

export default function ZonesManagerModal({ onClose }: { onClose: () => void }) {
  const [zones, setZones] = React.useState<Zone[]>([
    { id: "z-a", code: "A", name: "A — مدن رئيسية" },
    { id: "z-b", code: "B", name: "B — مدن متوسطة" },
    { id: "z-c", code: "C", name: "C — مناطق نائية" },
  ]);
  const [activeZoneId, setActiveZoneId] = React.useState<string>("z-a");

  const [data, setData] = React.useState<ZoneCities>({
    "z-a": [
      { id: "c-ryd", name: "الرياض" },
      { id: "c-jed", name: "جدة" },
      { id: "c-mak", name: "مكة" },
      { id: "c-med", name: "المدينة" },
      { id: "c-dmm", name: "الدمام" },
      { id: "c-khb", name: "الخبر" },
      { id: "c-dhr", name: "الظهران" },
      { id: "c-tai", name: "الطائف" },
      { id: "c-bur", name: "بريدة" },
      { id: "c-onz", name: "عنيزة" },
      { id: "c-tab", name: "تبوك" },
      { id: "c-hai", name: "حائل" },
      { id: "c-abh", name: "أبها" },
      { id: "c-kms", name: "خميس مشيط" },
      { id: "c-jaz", name: "جازان" },
      { id: "c-naj", name: "نجران" },
    ],
    "z-b": [],
    "z-c": [],
  });

  const activeCities = data[activeZoneId] || [];
  const [newCity, setNewCity] = React.useState("");

  const addZone = () => {
    const id = crypto.randomUUID();
    setZones((zs) => [...zs, { id, code: `Z${zs.length + 1}`, name: `منطقة ${zs.length + 1}` }]);
    setData((d) => ({ ...d, [id]: [] }));
    setActiveZoneId(id);
  };

  const addCity = () => {
    const name = newCity.trim();
    if (!name) return;
    const city: City = { id: crypto.randomUUID(), name };
    setData((d) => ({ ...d, [activeZoneId]: [...(d[activeZoneId] || []), city] }));
    setNewCity("");
  };

  const removeCity = (id: string) => {
    setData((d) => ({
      ...d,
      [activeZoneId]: (d[activeZoneId] || []).filter((c) => c.id !== id),
    }));
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="text-sm text-zinc-500">
        عرّف مناطق الشحن (بدون وزن) ثم اربط مدن كل منطقة.
      </div>

      <div className="grid grid-cols-4 gap-4">
        {/* الشريط الجانبي للمناطق */}
        <div className="col-span-1 space-y-2">
          {zones.map((z) => (
            <button
              key={z.id}
              className={`w-full text-start rounded-xl border px-3 py-2 ${activeZoneId === z.id ? "bg-zinc-50 border-zinc-300" : ""}`}
              onClick={() => setActiveZoneId(z.id)}
            >
              {z.name}
            </button>
          ))}
          <button className="w-full rounded-xl px-3 py-2 bg-emerald-600 text-white" onClick={addZone}>
            + إضافة منطقة
          </button>
        </div>

        {/* مدن المنطقة النشطة */}
        <div className="col-span-3">
          <div className="flex items-center gap-2 mb-3">
            <input
              className="flex-1 rounded-lg border px-3 py-2"
              placeholder="أدخل اسم مدينة وأضفها"
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
            />
            <button className="rounded-lg px-3 py-2 border" onClick={addCity}>
              إضافة
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-auto">
            {activeCities.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border px-3 py-2">
                <span>{c.name}</span>
                <button className="text-red-600" onClick={() => removeCity(c.id)}>
                  حذف
                </button>
              </div>
            ))}
            {activeCities.length === 0 && (
              <div className="text-sm text-zinc-500">لا توجد مدن بعد لهذه المنطقة.</div>
            )}
          </div>

          <div className="flex justify-end pt-3">
            <button className="rounded-xl px-4 py-2 border" onClick={onClose}>
              حفظ وإغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
