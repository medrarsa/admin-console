// src/lib/supabase/clients.ts
import { cookies } from "next/headers";
import { createBrowserClient, createServerClient, type CookieOptions } from "@supabase/ssr";

export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function createSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // تغليف cookies() ليتوافق مع @supabase/ssr
  const store = () =>
    cookies() as unknown as {
      get: (name: string) => { name: string; value: string } | undefined;
      set?: (name: string, value: string, options?: CookieOptions) => void;
    };

  return createServerClient(url, key, {
    cookies: {
      get(name) { return store().get(name)?.value; },
      set(name, value, options) { try { store().set?.(name, value, options); } catch {} },
      remove(name, options) { try { store().set?.(name, "", { ...(options||{}), maxAge: 0 }); } catch {} },
    },
  });
}
