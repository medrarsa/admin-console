"use client";

export default function PageContent({
  children,
}: {
  children: React.ReactNode;
}) {
  /**
   * ملاحظة:
   * - `lg:pr-[280px]` = إزاحة يمين ثابتة تماثل عرض السايدبار (280px) في الشاشات الكبيرة.
   * - `pt-[56px]` = إزاحة أعلى تساوي ارتفاع الـ Navbar.
   * - `min-h-screen` لضمان تمدد الخلفية.
   */
  return <div className="min-h-screen pt-[56px] lg:pr-[280px]">{children}</div>;
}
