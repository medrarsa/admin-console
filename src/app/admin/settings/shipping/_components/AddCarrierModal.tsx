"use client";
import * as React from "react";

type CarrierCard = { id: string; name: string; active: boolean; logo?: string };

export default function AddCarrierModal({
  mode = "create",
  initial,
  onSaved,
  onCancel,
}: {
  mode?: "create" | "edit";
  initial?: CarrierCard | null;
  onSaved: (c: CarrierCard) => void;
  onCancel: () => void;
}) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [active, setActive] = React.useState<boolean>(initial?.active ?? true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (initial) {
      setName(initial.name);
      setActive(!!initial.active);
    }
  }, [initial]);

  const save = async () => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("اكتب اسم الشركة.");
      return;
    }
    setSaving(true);
    try {
      if (mode === "edit" && initial?.id) {
        const r = await fetch(`/api/admin/shipping/companies/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed, active }),
        });
        const j = await r.json();
        if (!j?.success) throw new Error(j?.error?.message || "تعذّر التعديل");
        onSaved({
          id: j.data.id,
          name: j.data.name,
          active: !!j.data.is_active,
        });
      } else {
        const r = await fetch("/api/admin/shipping/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed, active }),
        });
        const j = await r.json();
        if (!j?.success) throw new Error(j?.error?.message || "تعذّر الإضافة");
        onSaved({
          id: j.data.id,
          name: j.data.name,
          active: !!j.data.is_active,
        });
      }
    } catch (e: any) {
      setError(e?.message || "حدث خطأ غير متوقّع");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-4"
      dir="rtl"
    >
      <div className="rounded-xl border p-3 space-y-3">
        <div className="font-medium">
          {mode === "edit" ? "تعديل شركة" : "بيانات الشركة"}
        </div>

        <label className="block">
          <div className="mb-1 text-sm">اسم الشركة</div>
          <input
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Naqel / Aramex / SMSA ..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
          />
        </label>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            disabled={saving}
          />
          <span>فعّالة</span>
        </label>

        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="rounded-xl px-4 py-2 border"
          onClick={onCancel}
          disabled={saving}
        >
          إلغاء
        </button>
        <button
          type="submit"
          className="rounded-xl px-4 py-2 bg-zinc-900 text-white disabled:opacity-60"
          disabled={saving}
        >
          {saving ? "يحفظ..." : "حفظ"}
        </button>
      </div>
    </form>
  );
}
