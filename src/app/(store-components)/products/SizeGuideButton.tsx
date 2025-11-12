// src/app/(store-components)/products/SizeGuideButton.tsx
"use client";
import * as React from "react";
import SizeGuideModal from "./SizeGuideModal";

export default function SizeGuideButton() {
  const open = () => {
    document.getElementById("size-guide-trigger")
      ?.dispatchEvent(new Event("click", { bubbles: true }));
  };
  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center gap-2 rounded-md border-2 border-indigo-200 px-4 py-2 text-[12px] text-indigo-600 hover:bg-indigo-50"
      >
        <span className="inline-grid h-4 w-4 place-items-center rounded bg-indigo-100 text-indigo-600">尺</span>
        Size Guide
      </button>
      <span id="size-guide-trigger" className="sr-only">
        <SizeGuideModal />
      </span>
    </>
  );
}
