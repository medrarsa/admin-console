// src/app/admin/_components/AdminGuard.tsx
import { ReactNode } from "react";
import { createSupabaseServer } from "@/lib/supabase/server";

const ALLOWED = [
  "admin",
  "manager",
  "cashier",
  "support",
  "content",
  "auditor",
];

export default async function AdminGuard({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createSupabaseServer();

  // 1) المستخدم
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // لا نفعل redirect هنا لأن الـ middleware يتكفّل بذلك
    return (
      <main className="min-h-[50vh] grid place-items-center p-10">
        <div className="text-center">
          <h2 className="text-2xl font-bold">غير مسجّل</h2>
          <p className="text-gray-600">
            الرجاء تسجيل الدخول للوصول إلى لوحة الإدارة.
          </p>
        </div>
      </main>
    );
  }

  // 2) الأدوار (يتطلب وجود view: my_roles كما أنشأناه في SQL)
  const { data: roles, error } = await supabase
    .from("my_roles")
    .select("role_code");
  if (error) {
    return (
      <main className="min-h-[50vh] grid place-items-center p-10">
        <div className="text-center">
          <h2 className="text-2xl font-bold">خطأ في جلب الأدوار</h2>
          <p className="text-red-600">{error.message}</p>
        </div>
      </main>
    );
  }

  const ok = roles?.some((r) => ALLOWED.includes(r.role_code)) ?? false;
  if (!ok) {
    return (
      <main className="min-h-[50vh] grid place-items-center p-10">
        <div className="text-center">
          <h2 className="text-2xl font-bold">403 — غير مُصرّح</h2>
          <p className="text-gray-600">
            ليس لديك صلاحية للوصول إلى هذه الصفحة.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
