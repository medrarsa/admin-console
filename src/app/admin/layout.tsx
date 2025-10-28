"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

/* === كروم الإدارة === */
import MainNavbar from "./_components/MainNavbar";
import MainSidebar from "./_components/MainSidebar";
import PageContent from "./_components/PageContent";
import MainContent from "./_components/MainContent";
/* الاستيراد الصحيح: اسمي وليس default */
import { SidebarProvider } from "./_components/SidebarProvider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [ready, setReady] = useState(false);

  // مسارات المصادقة: بدون حراسة وبدون كروم
  const AUTH_PATHS = ["/admin/login", "/admin/reset"];

  useEffect(() => {
    let cancelled = false;

    // لا تحرس صفحات auth
    if (AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p))) {
      setReady(true);
      return;
    }

    (async () => {
      const check = async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        return !!user;
      };

      let ok = await check();

      // أعد الفحص بعد لحظة في حال تأخر الكوكيز
      if (!ok) {
        await new Promise((r) => setTimeout(r, 300));
        ok = await check();
      }

      if (cancelled) return;

      if (!ok) {
        const next = encodeURIComponent(pathname || "/admin");
        router.replace(`/admin/login?next=${next}`);
      } else {
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router, supabase]);

  if (!ready) return <div className="p-6">جاري التحقق…</div>;

  // صفحات auth: لا كروم
  if (AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p))) {
    return <>{children}</>;
  }

  // باقي /admin: كروم كامل
  return (
    <SidebarProvider>
      <div className="min-h-screen">
        <MainNavbar />
        <MainSidebar />
        <PageContent>
          <MainContent>{children}</MainContent>
        </PageContent>
      </div>
    </SidebarProvider>
  );
}
