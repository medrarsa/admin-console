export const dynamic = "force-dynamic";
import Link from "next/link";

export default function MarketingToolsHome() {
  return (
    <div className="p-6 space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">الإدوات التسويقية</h1>
      <p className="text-zinc-500">اختر نوع الأداة.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/admin/marketing_tools/coupons"
          className="rounded-2xl border p-5 bg-white hover:bg-zinc-50 transition"
        >
          <div className="text-lg font-semibold mb-1">كوبونات التخفيض</div>
          <div className="text-sm text-zinc-500">إنشاء وإدارة الكوبونات.</div>
        </Link>
      </div>
    </div>
  );
}
