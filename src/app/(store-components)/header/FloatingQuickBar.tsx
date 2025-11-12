// src/app/(store-components)/header/FloatingQuickBar.tsx
"use client";
import Link from "next/link";
import { ShoppingBag, Search, User2 } from "lucide-react";

export default function FloatingQuickBar() {
  return (
    <div className="fixed bottom-5 end-5 z-40">
      <div className="flex flex-col items-center gap-2">
        <Link
          href="/cart"
          className="grid h-11 w-11 place-items-center rounded-full border border-zinc-200 bg-white shadow"
          title="السلة"
        >
          <ShoppingBag size={18} />
        </Link>
        <Link
          href="/search"
          className="grid h-11 w-11 place-items-center rounded-full border border-zinc-200 bg-white shadow"
          title="بحث"
        >
          <Search size={18} />
        </Link>
        <Link
          href="/account"
          className="grid h-11 w-11 place-items-center rounded-full border border-zinc-200 bg-white shadow"
          title="حسابي"
        >
          <User2 size={18} />
        </Link>
      </div>
    </div>
  );
}
