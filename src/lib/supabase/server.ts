import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** Supabase server client (Next 15 يتطلب await cookies()) */
async function _createServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies(); // ← مهم جدًا

  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) throw new Error("Supabase URL/Anon key are missing in .env.local");

  const storage = {
    getItem: (k: string) => cookieStore.get(k)?.value ?? null,
    setItem: (_k: string, _v: string) => {},
    removeItem: (_k: string) => {},
  };

  return createClient(url, anon, {
    auth: { persistSession: false, detectSessionInUrl: false, flowType: "pkce", storage },
    global: { headers: { "x-app-role": "admin-api" } },
  });
}

// تصديرين لتوافق جميع الراوتات
export default _createServerSupabase;
export const createServerSupabase = _createServerSupabase;
export const createServerClient   = _createServerSupabase; // لبعض الملفات القديمة
