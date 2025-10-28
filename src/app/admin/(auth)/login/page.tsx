// src/app/admin/(auth)/login/page.tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export default function AdminLoginPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const router = useRouter();
  const params = useSearchParams();

  // --- sanitize next ---
  const rawNext = params.get("next") || "/admin";
  function sanitizeNext(n: string) {
    try {
      if (/^https?:\/\//i.test(n)) return "/admin"; // امنع روابط خارجية
      if (n.startsWith("/admin")) {
        if (n === "/admin/reset" || n.startsWith("/admin/reset"))
          return "/admin";
        if (n === "/admin/login") return "/admin";
        return n;
      }
      return "/admin";
    } catch {
      return "/admin";
    }
  }
  const next = sanitizeNext(rawNext);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      router.push(next);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[70vh] grid place-items-center p-6" dir="rtl">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white border rounded-2xl shadow p-6 space-y-4"
      >
        <h1 className="text-xl font-bold text-center">
          تسجيل الدخول — لوحة الإدارة
        </h1>

        <div className="space-y-2">
          <label className="block text-sm">البريد الإلكتروني</label>
          <input
            type="email"
            className="w-full border rounded-lg px-3 h-10"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm">كلمة المرور</label>
          <input
            type="password"
            className="w-full border rounded-lg px-3 h-10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            minLength={8}
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-10 rounded-lg bg-black text-white font-semibold disabled:opacity-60"
        >
          {loading ? "جاري الدخول..." : "دخول"}
        </button>
      </form>
    </main>
  );
}
