"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

export default function Modal({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const router = useRouter();
  const onClose = () => router.back();

  React.useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
      />
      <div
        className="absolute inset-y-0 right-0 left-0 mx-auto my-auto h-fit max-h-[92vh] w-[min(900px,96vw)]
                      overflow-auto rounded-2xl bg-white shadow-2xl"
        dir="rtl"
      >
        <div className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur px-5 py-3 flex items-center justify-between">
          <h3 className="font-semibold">{title ?? ""}</h3>
          <button
            onClick={onClose}
            className="rounded-xl px-3 py-1.5 text-sm bg-zinc-100 hover:bg-zinc-200"
          >
            إغلاق
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
