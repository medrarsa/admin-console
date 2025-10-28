// src/app/admin/_components/LogoutButton.tsx
"use client";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export function LogoutButton() {
  const router = useRouter();
  async function signOut() {
    await createSupabaseBrowser().auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }
  return (
    <button onClick={signOut} className="px-3 h-9 rounded-lg border">
      تسجيل الخروج
    </button>
  );
}
