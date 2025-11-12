// src/app/(store-components)/header/StickyCategoriesShell.tsx
// Server Component (بدون "use client")
import * as React from "react";
import StickyCategoriesTabs from "./StickyCategoriesTabs";

export default function StickyCategoriesShell() {
  // يحجز المساحة والحدود فورًا من السيرفر
  return (
    <div
      className="sticky top-0 z-40 bg-white border-b border-zinc-200/70 shadow-[0_1px_0_0_rgba(0,0,0,0.03)]"
      style={{ minHeight: 44 }}
    >
      {/* نحافظ على نفس الهيكل حتى قبل هيدرِة العميل */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-11 items-center justify-between">
          {/* مكان الأيقونات يمين/يسار */}
          <div className="w-[96px]" aria-hidden />
          {/* مكان التبويبات (سيتم حقنه من Client) */}
          <div className="flex items-center justify-center gap-10 text-sm opacity-60">
            {/* Skeleton ثابت أثناء SSR كـ fallback سريع */}
            <span className="h-3 w-14 animate-pulse rounded bg-zinc-200/70" />
            <span className="h-3 w-16 animate-pulse rounded bg-zinc-200/70" />
            <span className="h-3 w-20 animate-pulse rounded bg-zinc-200/70" />
            <span className="h-3 w-12 animate-pulse rounded bg-zinc-200/70" />
          </div>
          <div className="w-[96px]" aria-hidden />
        </div>
      </div>

      {/* مكوّن العميل الفعلي يركّب فوق نفس المساحة بدون اهتزاز */}
      <StickyCategoriesTabs />
    </div>
  );
}
