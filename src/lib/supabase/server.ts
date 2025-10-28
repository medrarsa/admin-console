import { cookies } from "next/headers";
import { createClient as supaCreateClient, type SupabaseClient } from "@supabase/supabase-js";

/** إنشاء عميل Supabase مخصص للسيرفر (Next 15 يتطلب await cookies()) */
async function _createServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies(); // مهم جدًا في Next 15

  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) throw new Error("Supabase URL/Anon key are missing in .env.local");

  // نمرّر الدور للـ RLS
  const appRole = process.env.NEXT_PUBLIC_APP_ROLE || "admin";

  // تخزين جلسة “وهمي” لمنع أخطاء التخزين على السيرفر
  const storage = {
    getItem: (k: string) => cookieStore.get(k)?.value ?? null,
    setItem: () => {},
    removeItem: () => {},
  };

  return supaCreateClient(url, anon, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
      flowType: "pkce",
      storage,
    },
    global: {
      headers: { "x-app-role": appRole },
    },
  });
}

/* ===== التصديرات (لدعم كل أنماط الاستيراد القديمة والجديدة) ===== */
export default _createServerSupabase;              // import createServerClient from "@/lib/supabase/server"
export const createServerSupabase = _createServerSupabase;
export const createServerClient   = _createServerSupabase;
/** دعم ملفات قديمة كانت تستخدم { createClient } من نفس المسار */
export const createClient         = _createServerSupabase;
