export const dynamic = "force-dynamic";

import Link from "next/link";
import { headers } from "next/headers";
import CouponsTable from "../_components/CouponsTable";
import CouponsRefresh from "../_components/CouponsRefresh";

type RowApi = {
  id: string; // coupon.id
  code: string;
  type: string;
  status: string;
  amount: number | null;
  minimum_amount: number | null;
  maximum_amount: number | null;
  starts_at: string | null;
  ends_at: string | null;
  free_shipping: boolean | null;
  promotions: {
    id: string;
    name: string | null;
    status: string | null;
    free_shipping: boolean | null;
  } | null;
};

async function absoluteUrl(path: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}${path}`;
}

async function fetchRows(): Promise<RowApi[]> {
  const url = await absoluteUrl("/api/admin/marketing_tools/promotions");
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({}));
  return Array.isArray(j?.data) ? j.data : [];
}

export default async function CouponsPage() {
  const rowsApi = await fetchRows();

  const rows = rowsApi.map((x) => ({
    id: x.promotions?.id || x.id, // ✅ promotion.id للتعديل
    code: x.code,
    title: x.code, // أو x.promotions?.name?.trim() || x.code
    status: x.status,
    started_at: x.starts_at
      ? new Date(x.starts_at).toLocaleString("ar-EG")
      : "-",
    ends_at: x.ends_at ? new Date(x.ends_at).toLocaleString("ar-EG") : "-",
  }));

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <CouponsRefresh />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">كوبونات التخفيض</h1>
          <p className="text-zinc-500 text-sm">إنشاء وإدارة الكوبونات.</p>
        </div>
        <Link
          href="/admin/marketing_tools/coupons/new"
          className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          + إضافة
        </Link>
      </div>

      <CouponsTable rows={rows} />
    </div>
  );
}
