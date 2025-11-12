// src/app/(store-components)/header/StoreHeader.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag, Heart, User2, Headphones } from "lucide-react";
import Toast from "@/app/(store-components)/ui/Toast";

/* ----------------------- Helpers: read cart count once ---------------------- */
async function fetchCartCount(): Promise<number> {
  try {
    const r = await fetch("/api/store/cart", { cache: "no-store" });
    if (!r.ok) return 0;
    const j = await r.json();
    const items: Array<{ qty?: number }> = j?.data?.items ?? [];
    return items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
  } catch {
    return 0;
  }
}

/* ------------------ Mini confirmation with progress (auto hide) ------------------ */
/* ------------------ Mini confirmation with progress (auto hide) ------------------ */
 
/* --------------------- Cart badge: top-left + live updates --------------------- */
function CartBadgeContent() {
  const [count, setCount] = React.useState(0);
  const [pulse, setPulse] = React.useState(false);
  const [mini, setMini] = React.useState(false);

  // منع السبام على /api/store/cart
  const fetchingRef = React.useRef<Promise<number> | null>(null);
  const refresh = React.useCallback(async (opts?: { showMini?: boolean }) => {
    if (!fetchingRef.current) {
      fetchingRef.current = fetchCartCount().finally(() => {
        // نفرّغ المرجع بعد الإتمام
        setTimeout(() => (fetchingRef.current = null), 0);
      });
    }
    const c = await fetchingRef.current;
    setCount((prev) => {
      if (prev !== c) {
        setPulse(true);
        if (opts?.showMini) setMini(true);
        setTimeout(() => setPulse(false), 200);
      }
      return c;
    });
  }, []);

  React.useEffect(() => {
    // تحميل أولي
    refresh();

    // حدّث عند حدث cart-updated
    const onUpd = (e: Event) => {
      // @ts-expect-error custom detail
      const detail = e?.detail as { showMini?: boolean } | undefined;
      refresh({ showMini: !!detail?.showMini });
    };
    window.addEventListener("cart-updated", onUpd as EventListener);

    // ضَبّط أيضًا عند التركيز على النافذة
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("cart-updated", onUpd as EventListener);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const label = count > 99 ? "99+" : String(count);

  return (
    <>
      {/* الشارة الحمراء — أعلى يسار الأيقونة */}
      <span
        className={[
          "grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 text-[11px] font-semibold text-white",
          "bg-red-600 ring-2 ring-white shadow-sm",
          "transition-transform duration-150",
          pulse ? "scale-110" : "scale-100",
        ].join(" ")}
        aria-label="عدد عناصر السلة"
      >
        {label}
      </span>

      {/* تنبيه مصغّر مع شريط زمني يختفي تلقائيًا */}
      
    </>
  );
}

/* -------------------------------- Top Links -------------------------------- */
function TopLinksBar() {
  return (
    <div className="w-full border-b border-zinc-200/70 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-1.5 text-xs text-zinc-600 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
            <span className="text-[11px]">SA</span>
          </span>
          <Link href="/about" className="hover:text-zinc-800">من نحن</Link>
          <Link href="/partners" className="hover:text-zinc-800">انضم إلى برنامجنا للمؤثرين</Link>
          <Link href="/sell" className="hover:text-zinc-800">ابدأ بيع منتجاتك</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/returns" className="hover:text-zinc-800">مركز الإرجاع</Link>
          <Link href="/help" className="hover:text-zinc-800">المساعدة</Link>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Main Header ------------------------------- */
function MainHeader() {
  const router = useRouter();
  const [q, setQ] = React.useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sp = new URLSearchParams();
    const val = q.trim();
    if (val) sp.set("q", val);
    router.push(`/search?${sp.toString()}`);
  };

  return (
    <div className="w-full border-b border-zinc-200/70 bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-3 items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        {/* الشعار */}
        <div className="text-start">
          <Link href="/" className="text-[22px] font-extrabold tracking-wide">
            ELYAVYA
          </Link>
        </div>

        {/* البحث */}
        <div>
          <form onSubmit={onSubmit} className="relative w-full">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث عن فئة أو منتج أو علامة تجارية"
              className="w-full rounded-full border border-zinc-200 bg-white/70 backdrop-blur px-4 py-2.5 text-sm placeholder:text-zinc-400 outline-none transition focus:border-zinc-300 focus:ring-2 focus:ring-zinc-200/60"
            />
            <button
              type="submit"
              className="absolute inset-y-0 end-1 my-1 rounded-full bg-black/90 px-4 text-sm text-white transition hover:bg-black"
              aria-label="بحث"
            >
              بحث
            </button>
          </form>
        </div>

        {/* أيقونات */}
        <div className="flex items-center justify-end gap-4">
          {/* السلة */}
          <Link
            href="/cart"
            className="relative inline-flex items-center gap-1 text-sm text-zinc-600 transition hover:text-zinc-800"
            title="السلة"
          >
            <ShoppingBag size={22} />
            <span className="hidden sm:inline">السلة</span>

            {/* الشارة: أعلى يسار */}
            <span className="pointer-events-none absolute -top-2 -left-2 z-20">
              <CartBadgeContent />
            </span>
          </Link>

          <Link
            href="/favorites"
            className="inline-flex items-center gap-1 text-sm text-zinc-600 transition hover:text-zinc-800"
            title="المفضلة"
          >
            <Heart size={20} />
            <span className="hidden sm:inline">المفضلة</span>
          </Link>

          <Link
            href="/account"
            className="inline-flex items-center gap-1 text-sm text-zinc-600 transition hover:text-zinc-800"
            title="حسابي"
          >
            <User2 size={20} />
            <span className="hidden sm:inline">حسابي</span>
          </Link>

          <Link
            href="/support"
            className="inline-flex items-center gap-1 text-sm text-zinc-600 transition hover:text-zinc-800"
            title="الدعم"
          >
            <Headphones size={20} />
            <span className="hidden lg:inline">الدعم</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Export --------------------------------- */
export default function StoreHeader() {
  return (
    <header className="w-full bg-white">
      <Toast />
      <TopLinksBar />
      <MainHeader />
      {/* شريط الأقسام في layout */}
    </header>
  );
}
