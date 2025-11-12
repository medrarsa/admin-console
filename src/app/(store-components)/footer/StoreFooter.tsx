"use client";
import * as React from "react";

export default function StoreFooter() {
  return (
    <footer className="mt-16 border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-sm text-neutral-600">
        © {new Date().getFullYear()} Elyavya. جميع الحقوق محفوظة.
      </div>
    </footer>
  );
}
