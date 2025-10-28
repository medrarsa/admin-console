"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "الرئيسية" },
  { href: "/admin/catalog/categories", label: "الاقسام" },
  { href: "/admin/products", label: "المنتجات" },
  { href: "/admin/orders", label: "الطلبات" },
    { href: "/admin/catalog/brands", label: "الماركات" },
  { href: "/admin/customers", label: "العملاء" },
  { href: "/admin/reports", label: "التقارير" },
  { href: "/admin/feedback", label: "الأسئلة والتقييمات" },
  { href: "/admin/pages", label: "الصفحات التعريفية" },
  { href: "/admin/marketing/tools", label: "الأدوات التسويقية" },
];

export default function MainNavigation() {
  const pathname = usePathname();

  return (
    <nav className="px-2 py-3 space-y-1 overflow-y-auto h-[calc(100vh-56px)]">
      {NAV.map((item) => {
        const active =
          pathname === item.href || pathname?.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              active ? "bg-white/10" : "hover:bg-white/5"
            }`}
          >
            <span className="text-sm">{item.label}</span>
          </Link>
        );
      })}
      <div className="pt-3">
        <button className="w-full bg-white/10 hover:bg-white/15 rounded-lg py-2 text-sm">
          تسجيل الخروج
        </button>
      </div>
    </nav>
  );
}
