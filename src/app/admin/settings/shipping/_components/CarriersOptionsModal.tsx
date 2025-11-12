"use client";
import * as React from "react";

type Opt = { id: string; name: string; active: boolean; note?: string };

export default function CarriersOptionsModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [items, setItems] = React.useState<Opt[]>([
    { id: "smsa-tracking", name: "تتبع SMSA", active: true },
    { id: "aramex-tracking", name: "تتبع Aramex", active: false },
    { id: "spl-pickup", name: "استلام من البريد السعودي (SPL)", active: true },
  ]);

  const toggle = (id: string) =>
    setItems((xs) =>
      xs.map((x) => (x.id === id ? { ...x, active: !x.active } : x))
    );

  const save = () => {
    alert(JSON.stringify({ options: items }, null, 2));
    onClose();
  };

  return (
    <div className="space-y-3">
      {items.map((x) => (
        <label
          key={x.id}
          className="flex items-center justify-between rounded-xl border p-3"
        >
          <div>
            <div className="font-medium">{x.name}</div>
            {x.note && <div className="text-sm text-zinc-500">{x.note}</div>}
          </div>
          <input
            type="checkbox"
            checked={x.active}
            onChange={() => toggle(x.id)}
          />
        </label>
      ))}

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="rounded-xl border px-4 py-2">
          إغلاق
        </button>
        <button
          onClick={save}
          className="rounded-xl bg-black text-white px-4 py-2"
        >
          حفظ
        </button>
      </div>
    </div>
  );
}
