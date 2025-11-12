"use client";
import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function CouponsRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const did = useRef(false);

  useEffect(() => {
    const refresh = () => {
      if (did.current) return;
      did.current = true;
      setTimeout(() => {
        router.refresh();
        did.current = false;
      }, 60);
    };

    const onChanged = () => refresh();
    const onFocus = () => refresh();
    const onPop = () => refresh();

    window.addEventListener("coupons:changed", onChanged);
    window.addEventListener("focus", onFocus);
    window.addEventListener("popstate", onPop);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refresh();
    });

    return () => {
      window.removeEventListener("coupons:changed", onChanged);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("popstate", onPop);
    };
  }, [router, pathname]);

  return null;
}
