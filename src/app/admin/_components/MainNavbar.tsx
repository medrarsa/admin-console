"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useSidebarState } from "./SidebarProvider";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import {
  UserRound,
  Bell,
  Sparkles,
  PenLine,
  LogOut,
  ChevronDown,
} from "lucide-react";

export const NAVBAR_H = 56;

export default function MainNavbar() {
  const { toggle } = useSidebarState(); // ← يفتح/يغلق سايدبار الجوال
  const router = useRouter();

  // ==== منيو الحساب (مضمنة هنا) ====
  const [open, setOpen] = React.useState(false);
  const [coords, setCoords] = React.useState<{
    top: number;
    right: number;
  } | null>(null);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);

  const computeCoords = React.useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setCoords({
      top: Math.round(r.bottom + 8),
      right: Math.round(window.innerWidth - r.right),
    });
  }, []);

  const toggleMenu = React.useCallback(() => {
    setOpen((v) => {
      const next = !v;
      if (next) computeCoords();
      return next;
    });
  }, [computeCoords]);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onRelayout = () => {
      // لو المنيو مفتوحة وأعيد التمرير/التحجيم نعيد حساب الإحداثيات
      computeCoords();
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onEsc);
    window.addEventListener("scroll", onRelayout, true);
    window.addEventListener("resize", onRelayout);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onEsc);
      window.removeEventListener("scroll", onRelayout, true);
      window.removeEventListener("resize", onRelayout);
    };
  }, [open, computeCoords]);

  async function signOut() {
    await createSupabaseBrowser().auth.signOut();
    setOpen(false);
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <header
      className="
        fixed top-0 inset-x-0 z-50
        bg-white/90 backdrop-blur
        border-b border-gray-200 shadow-sm
      "
      style={{ height: NAVBAR_H }}
      dir="rtl"
    >
      <div className="mx-auto max-w-screen-2xl h-full px-3 sm:px-4 flex items-center gap-3">
        {/* زر القائمة للجوال */}
        <button
          className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-md border border-gray-200 hover:bg-gray-50"
          onClick={toggle}
          aria-label="فتح القائمة"
          type="button"
        >
          <span className="block w-5 h-0.5 bg-gray-800 mb-1"></span>
          <span className="block w-5 h-0.5 bg-gray-800 mb-1"></span>
          <span className="block w-5 h-0.5 bg-gray-800"></span>
        </button>

        {/* العنوان */}
        <div className="font-bold text-sm sm:text-base select-none">
          لوحة الإدارة
        </div>

        {/* دفع المحتوى لليمين */}
        <div className="ms-auto" />

        {/* زر الحساب + المنيو */}
        <button
          ref={btnRef}
          type="button"
          onClick={toggleMenu}
          className="flex items-center gap-2 h-9 px-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <div className="h-7 w-7 grid place-items-center rounded-full bg-gray-200 border border-gray-300">
            <UserRound size={16} />
          </div>
          <span className="hidden sm:inline text-sm">الحساب</span>
          <ChevronDown size={16} className="opacity-70" />
        </button>
      </div>

      {/* قائمة الحساب (Portal ثابتة) */}
      {open &&
        createPortal(
          <div
            dir="rtl"
            role="menu"
            className="fixed z-[100] w-64 rounded-xl border border-gray-200 bg-white shadow-2xl py-2"
            style={{
              top: coords?.top ?? NAVBAR_H + 8,
              right: coords?.right ?? 16,
            }}
          >
            <div className="px-3 pb-2 text-sm font-semibold">الحساب</div>
            <hr className="my-1" />
            <MenuItem icon={<UserRound size={16} />} label="الملف الشخصي" />
            <MenuItem icon={<Bell size={16} />} label="التنبيهات" />
            <MenuItem icon={<Sparkles size={16} />} label="تحديثات المنصة" />
            <MenuItem icon={<PenLine size={16} />} label="الاقتراحات" />
            <hr className="my-1" />
            <button
              onClick={signOut}
              className="w-full text-right flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50"
              role="menuitem"
              type="button"
            >
              <LogOut size={16} />
              <span>تسجيل الخروج</span>
            </button>
          </div>,
          document.body
        )}
    </header>
  );
}

function MenuItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      role="menuitem"
      className="w-full text-right flex items-center gap-2 px-3 py-2 hover:bg-gray-50"
    >
      <span className="[&>*]:opacity-80">{icon}</span>
      <span className="text-sm">{label}</span>
    </button>
  );
}
