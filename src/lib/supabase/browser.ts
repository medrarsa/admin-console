// src/lib/supabase/browser.ts
import { createBrowserClient as _createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowser() {
  return _createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// re-export باسم شائع، لتفادي لخبطة الاستيراد في الملفات الأخرى
export function createBrowserClient() {
  return createSupabaseBrowser();
}

