// src/lib/supabaseBrowser.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * سينجلتون لمنع إنشاء أكثر من GoTrueClient واحد في نفس سياق المتصفح
 * ويضمن تمرير x-app-role من الواجهة.
 */
let _client: SupabaseClient | null = null;

export function supabaseBrowser(appRole?: string) {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const role = appRole ?? process.env.NEXT_PUBLIC_APP_ROLE ?? "public";

  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  _client = createClient(url, key, {
    global: { headers: { "x-app-role": role } },
    auth: {
      // لا تلقائياً تخزّن/تنعش جلسة لو ما نحتاجها
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return _client!;
}
