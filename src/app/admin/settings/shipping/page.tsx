// src/app/admin/settings/shipping/page.tsx
"use client";

import * as React from "react";
import Modal from "./_components/Modal";
import FreeShippingModal from "./_components/FreeShippingModal";
import CODModal from "./_components/CODModal";
import CarriersOptionsModal from "./_components/CarriersOptionsModal";
import CarrierCODsModal from "./_components/CarrierCODsModal";
import PriceCalculatorModal from "./_components/PriceCalculatorModal";
import CarriersManagerModal from "./_components/CarriersManagerModal";
import ZonesManagerModal from "./_components/ZonesManagerModal";
import AddCarrierModal from "./_components/AddCarrierModal";

type Sheet =
  | "manage-carriers"
  | "manage-zones"
  | "free"
  | "cod"
  | "opts"
  | "carrier-cods"
  | "price"
  | null;
type CarrierCard = {
  id: string;
  name: string;
  logo?: string;
  active: boolean;
  support_cod?: boolean;
};

export default function ShippingIndex() {
  const [open, setOpen] = React.useState<Sheet>(null);
  const [showAdd, setShowAdd] = React.useState(false);
  const [editing, setEditing] = React.useState<CarrierCard | null>(null);
  const [cards, setCards] = React.useState<CarrierCard[]>([]);
  const [loading, setLoading] = React.useState(true);

  // تحميل الشركات من الـ API عند الفتح
  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/shipping/companies", {
          cache: "no-store",
        });
        const j = await r.json();
        const rows = Array.isArray(j?.data) ? j.data : [];
        setCards(
          rows.map((x: any) => ({
            id: x.id,
            name: x.name,
            active: !!x.is_active,
            support_cod: !!x.support_cod,
          }))
        );
      } catch {
        // تجاهل مؤقتًا
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const addCarrier = (c: CarrierCard) => setCards((xs) => [c, ...xs]);
  const updateCarrier = (c: CarrierCard) =>
    setCards((xs) => xs.map((x) => (x.id === c.id ? c : x)));
  const deleteCarrier = async (id: string) => {
    // تفاؤلي
    const prev = cards;
    setCards((xs) => xs.filter((x) => x.id !== id));
    try {
      await fetch(`/api/admin/shipping/companies/${id}`, { method: "DELETE" });
    } catch {
      setCards(prev);
    }
  };

  const toggleCarrier = async (c: CarrierCard) => {
    const next = !c.active;
    // تفاؤلي
    setCards((xs) =>
      xs.map((x) => (x.id === c.id ? { ...x, active: next } : x))
    );
    try {
      await fetch(`/api/admin/shipping/companies/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: c.name,
          active: next,
          support_cod: !!c.support_cod,
        }),
      });
    } catch {
      // رجوع
      setCards((xs) =>
        xs.map((x) => (x.id === c.id ? { ...x, active: !next } : x))
      );
    }
  };

  const Tile = ({
    icon,
    title,
    desc,
    onClick,
  }: {
    icon: React.ReactNode;
    title: string;
    desc: string;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className="w-full text-right rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:shadow-sm transition p-4 flex items-center justify-between"
    >
      <div className="flex items-center gap-4">
        <span className="grid place-items-center h-12 w-12 rounded-xl border">
          {icon}
        </span>
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-sm text-zinc-500">{desc}</div>
        </div>
      </div>
      <span className="text-zinc-400">⟵</span>
    </button>
  );

  return (
    <main className="px-6 py-8" dir="rtl">
      {/* هيدر + زر إضافة */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">إعدادات شركات الشحن</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-xl px-3 py-2 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          + إضافة شركة شحن
        </button>
      </div>

      {/* كروت الشركات */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border p-4 animate-pulse h-20 bg-zinc-50"
            />
          ))
        ) : cards.length === 0 ? (
          <div className="col-span-full text-sm text-zinc-500">
            لا توجد شركات بعد.
          </div>
        ) : (
          cards.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl border grid place-items-center">
                  {c.name?.[0] ?? "?"}
                </div>
                <div className="font-medium">{c.name}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={`rounded-lg px-3 py-1.5 border ${
                    c.active
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : ""
                  }`}
                  onClick={() => toggleCarrier(c)}
                >
                  {c.active ? "تعطيل" : "تفعيل"}
                </button>
                <button
                  className="rounded-lg px-3 py-1.5 border hover:bg-zinc-50"
                  onClick={() => setEditing(c)}
                >
                  تعديل
                </button>
                <button
                  className="rounded-lg px-3 py-1.5 border text-red-600 hover:bg-red-50"
                  onClick={() => deleteCarrier(c.id)}
                >
                  حذف
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* بطاقات الإعدادات */}
      <div className="space-y-3">
        <Tile
          icon={<span className="text-xl">🏷️</span>}
          title="شركات الشحن"
          desc="إضافة/تعديل الشركات وربطها بطرق الشحن وتسعير المناطق"
          onClick={() => setOpen("manage-carriers")}
        />
        <Tile
          icon={<span className="text-xl">🗺️</span>}
          title="المناطق والمدن"
          desc="تعريف المناطق (A/B/C) وربط مدن كل منطقة — بدون وزن"
          onClick={() => setOpen("manage-zones")}
        />
        <Tile
          icon={<span className="text-xl">🆓</span>}
          title="الشحن المجاني"
          desc="تحكم بإعدادات وشروط الشحن المجاني لعملاء متجرك"
          onClick={() => setOpen("free")}
        />
        <Tile
          icon={<span className="text-xl">💵</span>}
          title="الدفع عند الاستلام"
          desc="حدّد شروط الدفع عند الاستلام والتصنيفات المستثناة"
          onClick={() => setOpen("cod")}
        />
        <Tile
          icon={<span className="text-xl">🚚</span>}
          title="خيارات شركات الشحن"
          desc="تفعيل/تعطيل الخيارات، تحديث حالة الطلب، ومزامنة الكميات"
          onClick={() => setOpen("opts")}
        />
        <Tile
          icon={<span className="text-xl">📑</span>}
          title="قيود شركات الشحن"
          desc="إضافة قيود محددة لشركات الشحن المدعومة في متجرك"
          onClick={() => setOpen("carrier-cods")}
        />
        <Tile
          icon={<span className="text-xl">🧮</span>}
          title="حاسبة أسعار الشحن"
          desc="حدّد وجهة الشحنة لحساب التكلفة التقريبية (بدون وزن)"
          onClick={() => setOpen("price")}
        />
      </div>

      {/* مودال إضافة شركة */}
      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="إضافة شركة شحن"
      >
        <AddCarrierModal
          mode="create"
          onCancel={() => setShowAdd(false)}
          onSaved={(payload) => {
            addCarrier(payload);
            setShowAdd(false);
          }}
        />
      </Modal>

      {/* مودال تعديل شركة */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="تعديل شركة شحن"
      >
        {editing && (
          <AddCarrierModal
            mode="edit"
            initial={editing}
            onCancel={() => setEditing(null)}
            onSaved={(payload) => {
              updateCarrier(payload);
              setEditing(null);
            }}
          />
        )}
      </Modal>

      {/* باقي المودالات كما هي */}
      <Modal
        open={open === "manage-carriers"}
        onClose={() => setOpen(null)}
        title="شركات الشحن"
      >
        <CarriersManagerModal onClose={() => setOpen(null)} />
      </Modal>
      <Modal
        open={open === "manage-zones"}
        onClose={() => setOpen(null)}
        title="المناطق والمدن"
      >
        <ZonesManagerModal onClose={() => setOpen(null)} />
      </Modal>
      <Modal
        open={open === "free"}
        onClose={() => setOpen(null)}
        title="إعدادات الشحن المجاني"
      >
        <FreeShippingModal onClose={() => setOpen(null)} />
      </Modal>
      <Modal
        open={open === "cod"}
        onClose={() => setOpen(null)}
        title="شروط الدفع عند الاستلام"
      >
        <CODModal onClose={() => setOpen(null)} />
      </Modal>
      <Modal
        open={open === "opts"}
        onClose={() => setOpen(null)}
        title="خيارات شركات الشحن"
      >
        <CarriersOptionsModal onClose={() => setOpen(null)} />
      </Modal>
      <Modal
        open={open === "carrier-cods"}
        onClose={() => setOpen(null)}
        title="قيود شركات الشحن"
      >
        <CarrierCODsModal onClose={() => setOpen(null)} />
      </Modal>
      <Modal
        open={open === "price"}
        onClose={() => setOpen(null)}
        title="حاسبة أسعار الشحن"
      >
        <PriceCalculatorModal onClose={() => setOpen(null)} />
      </Modal>
    </main>
  );
}
