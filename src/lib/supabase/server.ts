// src/lib/supabase/server.ts
import { cookies } from "next/headers";
import {
  createClient as supaCreateClient,
  type SupabaseClient,
  // سنستخدم هذا لإنشاء عميل بصلاحية Service-Role فقط داخل الراوتات الإدارية
  createClient as supaAdminCreateClient,
} from "@supabase/supabase-js";

/**
 * إنشاء عميل Supabase مخصص للسيرفر (متوافق مع Next 15)
 * - يستخدم await cookies() كما يطلب Next 15.
 * - لا يثبّت الجلسة على السيرفر (persistSession=false).
 * - يمرر x-app-role إلى الـ RLS.
 * - يحافظ على نفس توقيع ودوال التصدير السابقة.
 */
async function _createServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies(); // مهم في Next 15

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Supabase URL/Anon key are missing. تأكد من وجود NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY في .env.local"
    );
  }

  // نمرّر الدور الحالي للـ RLS عبر هيدر (افتراضي admin لو ما تم تحديده)
  const appRole = process.env.NEXT_PUBLIC_APP_ROLE || "admin";

  // تخزين بسيط يقرأ الكوكيز فقط (لتفادي أخطاء التخزين في بيئة السيرفر)
  const storage = {
    getItem: (k: string) => cookieStore.get(k)?.value ?? null,
    setItem: (_k: string, _v: string) => {},
    removeItem: (_k: string) => {},
  };

  const client = supaCreateClient(url, anon, {
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

  return client as unknown as SupabaseClient;
}

/**
 * عميل Service-Role (يتجاوز RLS) — للاستخدام داخل Route Handlers الإدارية فقط
 * ⚠️ لا تستخدمه في المتجر العام أو في كومبوننتات الواجهة.
 */
export function createServiceRoleSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) {
    throw new Error(
      "Service Role or URL is missing. تأكد من وجود NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في .env.local"
    );
  }

  const adminClient = supaAdminCreateClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-app-role": "admin" } },
  });

  return adminClient as unknown as SupabaseClient;
}

/* ========= التصديرات (للتوافق مع الاستيرادات المختلفة) ========= */
// import createServerSupabase from "@/lib/supabase/server"
export default _createServerSupabase;

// import { createServerSupabase } from "@/lib/supabase/server"
export const createServerSupabase = _createServerSupabase;

// import { createServerClient } from "@/lib/supabase/server"
export const createServerClient = _createServerSupabase;

// دعم ملفات قديمة كانت تستورد createClient من نفس المسار:
// import { createClient } from "@/lib/supabase/server"
export const createClient = _createServerSupabase;
