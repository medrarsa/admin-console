// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/* مسارات عامة لا يلمسها الميدلوير */
const PUBLIC_AUTH_PATHS = [
  "/admin/(auth)/login",
  "/admin/(auth)/reset",
  "/admin/login",
  "/admin/reset",
  "/auth/callback",
];

/* UUID v4 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* تعريف “كود ذيل” صالح فقط: لاتيني/رقمي، قصير */
const TAIL_CODE_RE = /^[A-Za-z0-9]{3,12}$/;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) استثناء مسارات المصادقة
  for (const p of PUBLIC_AUTH_PATHS) {
    if (pathname.startsWith(p)) return NextResponse.next();
  }

  // 2) /admin يمرّ بدون فحص كوكيز هنا
  if (pathname.startsWith("/admin")) return NextResponse.next();

  // 3) تنظيف روابط المنتجات للـSEO — بحذر شديد
  if (pathname.startsWith("/products/")) {
    // لا نفك ترميز المسار هنا (تجنّب double-encoding)
    const rawPart = pathname.slice("/products/".length);

    // أ) UUID يمر كما هو
    if (UUID_RE.test(rawPart)) return NextResponse.next();

    // ب) قصّ الذيل فقط إذا كان tail كود لاتيني/رقمي قصير
    const idx = rawPart.lastIndexOf("-");
    if (idx > 0 && idx < rawPart.length - 1) {
      const baseSlug = rawPart.slice(0, idx);
      const tail = rawPart.slice(idx + 1);

      if (TAIL_CODE_RE.test(tail)) {
        const cleanPath = `/products/${baseSlug}`; // بدون أي ترميز إضافي
        if (pathname !== cleanPath) {
          const url = req.nextUrl.clone();
          url.pathname = cleanPath;
          const res = NextResponse.redirect(url, 301);
          res.headers.set("x-robots-tag", "noindex, follow");
          return res;
        }
      }
    }

    // ج) لو فيه سلاش/مسافات زائدة داخل جزء السلاج نفسه، نظّفها
    // ملاحظة: لا نفك ترميز، ننظّف فقط الأطراف حتى لا نغيّر المحتوى العربي المشفّر طبيعيًا
    const trimmed = rawPart.replace(/^\/+|^\s+|\s+$/g, "");
    if (trimmed !== rawPart) {
      const cleanPath = `/products/${trimmed}`;
      if (pathname !== cleanPath) {
        const url = req.nextUrl.clone();
        url.pathname = cleanPath;
        const res = NextResponse.redirect(url, 301);
        res.headers.set("x-robots-tag", "noindex, follow");
        return res;
      }
    }
  }

  // 4) باقي الموقع
  return NextResponse.next();
}

/* الماتشر */
export const config = {
  matcher: ["/((?!api|_next|favicon.ico|assets|image).*)"],
};
