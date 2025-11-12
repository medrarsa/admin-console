"use client";
import Link from "next/link";
import CouponStatusSwitch from "./CouponStatusSwitch";

type Row = {
  id: string; // promotion.id (جاينا من الصفحة)
  code: string;
  title: string; // اسم العرض أو الكود
  status: string; // active / paused / expired …
  started_at: string | null; // نص جاهز للعرض
  ends_at: string | null; // نص جاهز للعرض
};

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700",
    paused: "bg-amber-100 text-amber-700",
    expired: "bg-rose-100 text-rose-700",
  };
  const cls = map[status] ?? "bg-zinc-100 text-zinc-700";
  const label = status; // ممكن تعريب لاحقًا
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

export default function CouponsTable({ rows }: { rows: Row[] }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
      {/* رأس الجدول */}
      <div className="grid grid-cols-12 items-center px-4 py-3 bg-zinc-50 text-zinc-600 text-sm border-b">
        <div className="col-span-1">تفعيل</div>
        <div className="col-span-1">إحصائيات</div>
        <div className="col-span-4">عنوان الكوبون / الكود</div>
        <div className="col-span-2">الحالة</div>
        <div className="col-span-2">بداية</div>
        <div className="col-span-2">انتهاء</div>
      </div>

      {/* صفوف */}
      {rows.map((r) => {
        const isOn = r.status === "active";
        return (
          <div
            key={r.id}
            className="grid grid-cols-12 items-center px-4 py-3 border-b last:border-b-0"
          >
            {/* سويتش */}
            <div className="col-span-1">
              <CouponStatusSwitch promotionId={r.id} checked={isOn} />
            </div>

            {/* زر إحصائيات (placeholder) */}
            <div className="col-span-1">
              <Link
                href="#"
                className="text-zinc-500 hover:text-zinc-800 text-xs inline-flex items-center gap-1"
              >
                <span
                  className="i-lucide:bar-chart-3"
                  aria-hidden="true"
                ></span>{" "}
                إحصائيات
              </Link>
            </div>

            {/* اسم الكوبون → يفتح المودال */}
            <div className="col-span-4">
              <Link
                href={`/admin/marketing_tools/coupons/edit/${r.id}`}
                className="text-emerald-700 hover:underline font-medium"
              >
                {r.title}
              </Link>
              <div className="text-xs text-zinc-500">{r.code}</div>
            </div>

            {/* الحالة */}
            <div className="col-span-2">
              <StatusPill status={r.status} />
            </div>

            {/* التواريخ */}
            <div className="col-span-2 text-zinc-700">
              {r.started_at || "-"}
            </div>
            <div className="col-span-2 text-zinc-700">{r.ends_at || "-"}</div>
          </div>
        );
      })}
    </div>
  );
}
