"use client";
import * as React from "react";

export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className="absolute left-1/2 top-10 -translate-x-1/2 w-[min(880px,92vw)] rounded-2xl bg-white shadow-2xl border"
        dir="rtl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b bg-emerald-50/60 rounded-t-2xl">
          <div className="font-semibold">{title}</div>
          <button
            onClick={onClose}
            className="h-9 w-9 grid place-items-center rounded-full hover:bg-emerald-100"
            aria-label="Close"
          >
            ✖
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
