"use client";
import { useMemo, useState } from "react";

/** نموذج بيانات واجهة فقط (Mock). لاحقًا نستبدله ببيانات Supabase */
type P = {
  id: string;
  img?: string;
  name: string;
  price?: number | null;
  qty?: number | null;
  unlimited?: boolean;
  tags: string[];
  vendor?: string | null;
  status: "active" | "draft" | "archived";
};

const MOCK: P[] = [
  {
    id: "1",
    img: "",
    name: "علبة كلتش فوق هايلوكس دبل 2016-2024",
    price: 150,
    qty: null,
    unlimited: true,
    tags: ["قطع غيار هايلوكس دبل", "قطع الغيار/السيارات"],
    vendor: "TOYC",
    status: "active",
  },
  {
    id: "2",
    img: "",
    name: "اسطب ركن امامي يسار صالون 8 سلندر 98",
    price: 48,
    qty: null,
    unlimited: true,
    tags: ["قطع غيار صالون 8 سلندر"],
    vendor: "DEPO",
    status: "active",
  },
  {
    id: "3",
    img: "",
    name: "علبة كلتش تحت هايلوكس دبل 2016-2024",
    price: 340.3,
    qty: 10,
    unlimited: false,
    tags: ["هايلوكس دبل"],
    vendor: "TOYC",
    status: "draft",
  },
];

export default function ProductsLikeSalla() {
  // حالة واجهة
  const [items, setItems] = useState<P[]>(MOCK);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [status, setStatus] = useState<"all" | P["status"]>("all");

  const filtered = useMemo(() => {
    return items.filter((p) => {
      const okQ = !q || p.name.toLowerCase().includes(q.toLowerCase());
      const okS = status === "all" || p.status === status;
      return okQ && okS;
    });
  }, [items, q, status]);

  function update(id: string, patch: Partial<P>) {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function removeTag(id: string, tag: string) {
    update(id, {
      tags: items.find((x) => x.id === id)!.tags.filter((t) => t !== tag),
    });
  }

  function addTag(id: string, tag: string) {
    if (!tag.trim()) return;
    const cur = items.find((x) => x.id === id)!;
    if (cur.tags.includes(tag)) return;
    update(id, { tags: [...cur.tags, tag] });
  }

  async function saveOne(id: string) {
    // لاحقًا: استدعاء Supabase (UPDATE) + تمرير x-app-role
    // مثال:
    // const supabase = supabaseBrowser();
    // await supabase.from("products").update({...}).eq("id", id);
    alert(`تم حفظ المنتج #${id} (واجهة فقط).`);
  }

  return (
    <div className="space-y-4">
      {/* شريط أدوات علوي */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          placeholder="ابحث باسم المنتج..."
          className="border rounded-lg px-3 py-2 min-w-64"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="border rounded-lg px-3 py-2"
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
        >
          <option value="all">كل الحالات</option>
          <option value="active">فعال</option>
          <option value="draft">مسودة</option>
          <option value="archived">مؤرشف</option>
        </select>

        <div className="ms-auto flex gap-2">
          <button
            onClick={() => setView("grid")}
            className={`px-3 py-2 rounded-lg border ${
              view === "grid" ? "bg-black text-white" : "bg-white"
            }`}
            title="شبكة"
          >
            شبكة
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-2 rounded-lg border ${
              view === "list" ? "bg-black text-white" : "bg-white"
            }`}
            title="قائمة"
          >
            قائمة
          </button>
          <a
            href="/admin/products/new"
            className="px-3 py-2 rounded-lg bg-emerald-600 text-white"
          >
            إضافة منتج جديد
          </a>
        </div>
      </div>

      {/* شبكة/قائمة البطاقات */}
      {filtered.length === 0 ? (
        <div className="border rounded-xl p-6 text-center">
          لا توجد نتائج مطابقة.
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 md:grid-cols-3">
          {filtered.map((p) => (
            <Card
              key={p.id}
              data={p}
              onChange={update}
              onRemoveTag={removeTag}
              onAddTag={addTag}
              onSave={saveOne}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => (
            <Card
              key={p.id}
              data={p}
              onChange={update}
              onRemoveTag={removeTag}
              onAddTag={addTag}
              onSave={saveOne}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** بطاقة واحدة على نمط سلة */
function Card({
  data,
  onChange,
  onRemoveTag,
  onAddTag,
  onSave,
  compact = false,
}: {
  data: P;
  onChange: (id: string, patch: Partial<P>) => void;
  onRemoveTag: (id: string, tag: string) => void;
  onAddTag: (id: string, tag: string) => void;
  onSave: (id: string) => Promise<void> | void;
  compact?: boolean;
}) {
  const [tagDraft, setTagDraft] = useState("");

  return (
    <div className={`border rounded-xl ${compact ? "p-3" : "p-4"} bg-white`}>
      {/* رأس البطاقة: لوجو/وسم المتجر + حالة */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-500">DARB • Admin</div>
        <select
          className="border rounded-lg px-2 py-1 text-xs"
          value={data.status}
          onChange={(e) =>
            onChange(data.id, { status: e.target.value as P["status"] })
          }
        >
          <option value="active">فعال</option>
          <option value="draft">مسودة</option>
          <option value="archived">مؤرشف</option>
        </select>
      </div>

      {/* الصورة + سيارة مصغّرة (مكان فقط) */}
      <div
        className={`grid ${
          compact ? "grid-cols-[96px_1fr]" : "grid-cols-[140px_1fr]"
        } gap-3`}
      >
        <div className="border rounded-lg aspect-square overflow-hidden flex items-center justify-center bg-gray-50">
          {data.img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.img}
              alt=""
              className="object-contain w-full h-full"
            />
          ) : (
            <span className="text-xs text-gray-400">بدون صورة</span>
          )}
        </div>

        {/* الحقول الأساسية */}
        <div className="grid gap-2">
          <input
            className="border rounded-lg px-3 py-2 w-full"
            value={data.name}
            onChange={(e) => onChange(data.id, { name: e.target.value })}
          />

          {/* السعر + الكمية + غير محدود */}
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs text-gray-600">
              السعر (ريال)
              <input
                type="number"
                className="border rounded-lg px-2 py-2 w-full"
                value={data.price ?? ""}
                onChange={(e) =>
                  onChange(data.id, {
                    price: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </label>

            <label className="text-xs text-gray-600">
              الكمية
              <input
                type="number"
                className="border rounded-lg px-2 py-2 w-full"
                value={data.unlimited ? "" : data.qty ?? ""}
                onChange={(e) =>
                  onChange(data.id, {
                    qty: e.target.value ? Number(e.target.value) : null,
                  })
                }
                disabled={data.unlimited}
              />
            </label>

            <label className="flex items-center gap-2 text-xs text-gray-600 mt-5">
              <input
                type="checkbox"
                checked={!!data.unlimited}
                onChange={(e) =>
                  onChange(data.id, {
                    unlimited: e.target.checked,
                    qty: e.target.checked ? null : data.qty ?? 0,
                  })
                }
              />
              كمية غير محدودة
            </label>
          </div>

          {/* الوسوم (تصنيفات) */}
          <div className="grid gap-1">
            <div className="flex flex-wrap gap-2">
              {data.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-2 text-xs border rounded-full px-2 py-1 bg-gray-50"
                >
                  {t}
                  <button
                    className="text-gray-500 hover:text-red-600"
                    onClick={() => onRemoveTag(data.id, t)}
                    title="حذف الوسم"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                placeholder="إضافة وسم/تصنيف…"
                className="border rounded-lg px-3 py-2 text-sm flex-1"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onAddTag(data.id, tagDraft.trim());
                    setTagDraft("");
                  }
                }}
              />
              <button
                className="px-3 py-2 border rounded-lg"
                onClick={() => {
                  onAddTag(data.id, tagDraft.trim());
                  setTagDraft("");
                }}
              >
                إضافة
              </button>
            </div>
          </div>

          {/* مورد + عمليات سريعة */}
          <div className="grid grid-cols-2 gap-2">
            <select
              className="border rounded-lg px-3 py-2"
              value={data.vendor ?? ""}
              onChange={(e) =>
                onChange(data.id, { vendor: e.target.value || null })
              }
            >
              <option value="">بدون مورد</option>
              <option value="TOYC">TOYC</option>
              <option value="DEPO">DEPO</option>
              <option value="DENSO">DENSO</option>
              <option value="AISIN">AISIN</option>
            </select>

            <div className="flex gap-2 justify-end">
              <a
                className="px-3 py-2 rounded-lg border"
                href={`/admin/products/${data.id}/details`}
                title="بيانات المنتج"
              >
                بيانات المنتج
              </a>
              <button
                className="px-3 py-2 rounded-lg bg-black text-white"
                onClick={() => onSave(data.id)}
              >
                حفظ
              </button>
            </div>
          </div>

          {/* سطر سفلي يشبه سلة */}
          <div className="flex items-center justify-between pt-2 border-t">
            <a className="text-sm underline text-sky-600" href="#">
              المزيد
            </a>
            <div className="text-xs text-gray-500">
              مورد: {data.vendor ?? "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
