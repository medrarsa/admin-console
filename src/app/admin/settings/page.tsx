// src/app/admin/settings/page.tsx
export const dynamic = "force-static";

import Link from "next/link";

export default function SettingsHome() {
  return (
    <main className="px-6 py-8" dir="rtl">
      <h1 className="text-2xl font-bold mb-6 text-right">إعدادات المتجر</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* بطاقة خيارات الشحن */}
        <Link
          href="/admin/settings/shipping"
          className="group rounded-2xl border border-zinc-200 p-5 hover:border-zinc-300 hover:shadow-sm transition text-right"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-semibold">خيارات الشحن</span>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border">
              🚚
            </span>
          </div>
          <p className="text-sm text-zinc-500">
            إدارة الشحن المجاني، الدفع عند الاستلام، قيود الشركات، وحاسبة الأسعار.
          </p>
        </Link>

        {/* بطاقة إعدادات المدن والبلدان */}
        <Link
          href="/admin/settings/countries"
          className="group rounded-2xl border border-zinc-200 p-5 hover:border-zinc-300 hover:shadow-sm transition text-right"
          aria-label="إعدادات المدن والبلدان"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-semibold">إعدادات المدن والبلدان</span>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border">
              🌍
            </span>
          </div>
          <p className="text-sm text-zinc-500">
            إدارة البلدان (اليمن، السعودية…) وإضافة مدن كل بلد عبر نوافذ منبثقة.
          </p>
        </Link>

        {/* بطاقات مستقبلية (placeholder) */}
        <div className="rounded-2xl border border-dashed p-5 text-right text-zinc-400">
          سيتم إضافة إعدادات أخرى لاحقًا
        </div>
      </div>
    </main>
  );
}
