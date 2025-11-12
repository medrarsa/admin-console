// src/app/admin/settings/shipping/page.tsx
"use client";

import * as React from "react";
import Modal from "./_components/Modal";
import FreeShippingModal from "./_components/FreeShippingModal";
import CODModal from "./_components/CODModal";
import CarriersOptionsModal from "./_components/CarriersOptionsModal";
import CarrierCODsModal from "./_components/CarrierCODsModal";
import PriceCalculatorModal from "./_components/PriceCalculatorModal";

/* === جديد: مدير الشركات والمناطق + إضافة شركة === */
import CarriersManagerModal from "./_components/CarriersManagerModal";
import ZonesManagerModal from "./_components/ZonesManagerModal";
import AddCarrierModal from "./_components/AddCarrierModal"; // << جديد

type Sheet =
  | "manage-carriers"
  | "manage-zones"
  | "free"
  | "cod"
  | "opts"
  | "carrier-cods"
  | "price"
  | null;

type CarrierCard = { id: string; name: string; logo?: string; active: boolean };

export default function ShippingIndex() {
  const [open, setOpen] = React.useState<Sheet>(null);
  const [showAdd, setShowAdd] = React.useState(false); // << جديد

  // كروت شركات أعلى الصفحة (واجهة فقط حالياً)
  const [cards, setCards] = React.useState<CarrierCard[]>([
    { id: "c-smsa", name: "سمسا", active: true },
    { id: "c-aymakan", name: "أي مكان", active: false },
    { id: "c-jt", name: "جي اند تي", active: false },
    { id: "c-aramex", name: "أرامكس", active: false },
  ]);

  const handleAdded = (c: CarrierCard) => {
    setCards((xs) => [c, ...xs]);  // تظهر فورًا
    setShowAdd(false);
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
      {/* هيدر + زر إضافة شركة */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">إعدادات شركات الشحن</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-xl px-3 py-2 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          + إضافة شركة شحن
        </button>
      </div>

      {/* شبكة كروت الشركات (شكل بسيط) */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.id} className="rounded-2xl border p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl border grid place-items-center">{c.name[0]}</div>
              <div className="font-medium">{c.name}</div>
            </div>
            <span className="text-xs px-2 py-1 rounded-full border">
              {c.active ? "مفعّلة" : "معطّلة"}
            </span>
          </div>
        ))}
      </div>

      {/* بطاقات إعداداتك كما هي */}
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

      {/* مودال إضافة شركة — جديد */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="إضافة شركة شحن">
        <AddCarrierModal
          onCancel={() => setShowAdd(false)}
          onSaved={(payload) => handleAdded(payload)}
        />
      </Modal>

      {/* المودالات الأخرى كما هي */}
      <Modal open={open === "manage-carriers"} onClose={() => setOpen(null)} title="شركات الشحن">
        <CarriersManagerModal onClose={() => setOpen(null)} />
      </Modal>

      <Modal open={open === "manage-zones"} onClose={() => setOpen(null)} title="المناطق والمدن">
        <ZonesManagerModal onClose={() => setOpen(null)} />
      </Modal>

      <Modal open={open === "free"} onClose={() => setOpen(null)} title="إعدادات الشحن المجاني">
        <FreeShippingModal onClose={() => setOpen(null)} />
      </Modal>

      <Modal open={open === "cod"} onClose={() => setOpen(null)} title="شروط الدفع عند الاستلام">
        <CODModal onClose={() => setOpen(null)} />
      </Modal>

      <Modal open={open === "opts"} onClose={() => setOpen(null)} title="خيارات شركات الشحن">
        <CarriersOptionsModal onClose={() => setOpen(null)} />
      </Modal>

      <Modal open={open === "carrier-cods"} onClose={() => setOpen(null)} title="قيود شركات الشحن">
        <CarrierCODsModal onClose={() => setOpen(null)} />
      </Modal>

      <Modal open={open === "price"} onClose={() => setOpen(null)} title="حاسبة أسعار الشحن">
        <PriceCalculatorModal onClose={() => setOpen(null)} />
      </Modal>
    </main>
  );
}
