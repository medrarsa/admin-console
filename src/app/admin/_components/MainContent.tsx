"use client";

export default function MainContent({
  children,
}: {
  children: React.ReactNode;
}) {
  /**
   * الفكرة:
   * - `container` أو `max-w-7xl` لتحديد عرض منطقي للمحتوى.
   * - `mx-auto` لتوسيطه.
   * - `px-3 lg:px-6` هو هوامش جانبية.
   */
  return <main className="mx-auto max-w-7xl px-3 lg:px-6">{children}</main>;
}
