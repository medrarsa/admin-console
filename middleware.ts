import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * مسارات عامة لا يجب أن يلمسها الميدلوير نهائيًا
 * لاحظ أننا أضفنا المسارات بصيغتين:
 * 1) مع مجموعة الراوت (auth)
 * 2) بدونها - احتياط إن ما كانت المجموعة موجودة
 */
const PUBLIC_AUTH_PATHS = [
  "/admin/(auth)/login",
  "/admin/(auth)/reset",
  "/admin/login",
  "/admin/reset",
  // لو عندك مسار كولباك للمصادقة ضيفه هنا
  "/auth/callback",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) استثناء مسارات المصادقة كليًا
  for (const p of PUBLIC_AUTH_PATHS) {
    if (pathname.startsWith(p)) {
      return NextResponse.next();
    }
  }

  // 2) حماية خفيفة لباقي /admin (بدون فحص كوكيز هنا)
  if (pathname.startsWith("/admin")) {
    // لا تفحص الكوكيز هنا (علشان مشكلة next 15 مع cookies sync)
    // الحارس يكون داخل layout.tsx (عميل) أو سيرفر لاحقًا
    return NextResponse.next();
  }

  // باقي الموقع يمر عادي
  return NextResponse.next();
}

/**
 * الماتشر يحدد المسارات اللي يشتغل عليها الميدلوير.
 * هنا نخصصه على /admin فقط لتقليل التدخل.
 */
export const config = {
 matcher: ["/((?!api|_next|favicon.ico|assets|image).*)"],
};
