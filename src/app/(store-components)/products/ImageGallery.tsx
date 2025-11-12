// src/app/(store-components)/products/ImageGallery.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import { Gallery, Item } from "react-photoswipe-gallery";
// تذكير: @import "photoswipe/style.css" في globals.css

export default function ImageGallery({ images }: { images: string[] }) {
  const safe = Array.isArray(images) ? images.filter(Boolean) : [];
  const [active, setActive] = React.useState(0);

  if (safe.length === 0) {
    return (
      <div className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden ring-1 ring-zinc-200/70 bg-white grid place-items-center text-zinc-400 shadow-sm">
        No Image
      </div>
    );
  }

  const main = safe[Math.min(active, safe.length - 1)]!;
  const guessSize = (_: string) => ({ w: 1200, h: 1500, alt: "product" });

  const prev = () => setActive((i) => Math.max(i - 1, 0));
  const next = () => setActive((i) => Math.min(i + 1, safe.length - 1));

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") next();
      if (e.key === "ArrowRight") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [safe.length]);

  const [hint, setHint] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setHint(false), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <Gallery
      withCaption={false}
      options={{
        bgOpacity: 1,
        wheelToZoom: true,
        loop: false,
        pswpModule: () => import("photoswipe"),
        padding: { top: 24, bottom: 24, left: 16, right: 16 },
        pinchToClose: true,
        escKey: true,
      }}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Thumbs */}
        <aside className="order-2 lg:order-1 lg:col-span-2">
          <div className="flex lg:flex-col gap-3 overflow-auto pe-1 lg:pe-0 lg:pb-1">
            {safe.map((src, i) => {
              const { w, h } = guessSize(src);
              const isActive = i === active;
              return (
                <Item
                  key={i}
                  original={src}
                  thumbnail={src}
                  width={w}
                  height={h}
                >
                  {({ ref, open }) => (
                    <button
                      ref={ref as any}
                      type="button"
                      onClick={(e) => {
                        setActive(i);
                        open(e);
                      }}
                      className={[
                        "relative aspect-[4/5] w-20 lg:w-full overflow-hidden rounded-xl ring-1 transition-all",
                        "bg-white shadow-sm",
                        isActive
                          ? "ring-zinc-900/80"
                          : "ring-zinc-200 hover:ring-zinc-300",
                      ].join(" ")}
                      title={`صورة ${i + 1}`}
                    >
                      <Image
                        src={src}
                        alt={`thumb-${i}`}
                        fill
                        className={[
                          "object-cover",
                          isActive ? "scale-[1.01]" : "hover:scale-[1.01]",
                          "transition-transform duration-300",
                        ].join(" ")}
                        sizes="200px"
                        priority={i === 0}
                      />
                      {/* مؤشر تفعيل بسيط ومحايد */}
                      {isActive && (
                        <span className="absolute inset-x-0 bottom-0 h-[2px] bg-zinc-900" />
                      )}
                    </button>
                  )}
                </Item>
              );
            })}
          </div>
        </aside>

        {/* Main */}
        <section className="order-1 lg:order-2 lg:col-span-10 relative">
          <div
            className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl ring-1 ring-zinc-200 bg-white group shadow-[0_12px_40px_-16px_rgba(0,0,0,.18)]"
            onMouseMove={() => setHint(true)}
            onMouseLeave={() => setHint(false)}
            onTouchStart={() => setHint(true)}
          >
            {/* حافة ناعمة جداً */}
            <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-black/[0.03]" />

            {/* الصورة الرئيسية */}
            <Item original={main} thumbnail={main} {...guessSize(main)}>
              {({ ref, open }) => (
                <Image
                  ref={ref as any}
                  key={main}
                  src={main}
                  alt="صورة المنتج"
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.02] cursor-zoom-in"
                  sizes="800px"
                  priority
                  onClick={(e) => open(e)}
                />
              )}
            </Item>

            {/* أسهم سوداء فاخرة */}
            {safe.length > 1 && (
              <>
                {/* التالي (يمين) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    next();
                  }}
                  disabled={active === safe.length - 1}
                  aria-label="التالي"
                  className={[
                    "absolute inset-y-0 right-0 w-[20%] max-w-[200px]",
                    "flex items-center justify-end pr-4",
                    "bg-gradient-to-l from-black/5 to-transparent",
                    "transition-opacity",
                    hint
                      ? "opacity-100"
                      : "opacity-0 md:group-hover:opacity-100",
                    "disabled:opacity-20 disabled:cursor-not-allowed",
                  ].join(" ")}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <span
                    className={[
                      "grid place-items-center h-11 w-11 rounded-full",
                      "bg-black text-white shadow-sm ring-1 ring-black/10",
                      "transition-transform hover:scale-[1.04]",
                    ].join(" ")}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="ltr:rotate-0 rtl:rotate-180"
                    >
                      <path
                        d="M8 5l8 7-8 7"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>

                {/* السابق (يسار) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    prev();
                  }}
                  disabled={active === 0}
                  aria-label="السابق"
                  className={[
                    "absolute inset-y-0 left-0 w-[20%] max-w-[200px]",
                    "flex items-center justify-start pl-4",
                    "bg-gradient-to-r from-black/5 to-transparent",
                    "transition-opacity",
                    hint
                      ? "opacity-100"
                      : "opacity-0 md:group-hover:opacity-100",
                    "disabled:opacity-20 disabled:cursor-not-allowed",
                  ].join(" ")}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <span
                    className={[
                      "grid place-items-center h-11 w-11 rounded-full",
                      "bg-black text-white shadow-sm ring-1 ring-black/10",
                      "transition-transform hover:scale-[1.04]",
                    ].join(" ")}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="ltr:rotate-180 rtl:rotate-0"
                    >
                      <path
                        d="M8 5l8 7-8 7"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>
              </>
            )}

            {/* نقاط التقدم – محايدة */}
            {safe.length > 1 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
                {safe.map((_, i) => (
                  <span
                    key={i}
                    className={[
                      "inline-block h-1.5 rounded-full transition-all duration-300",
                      i === active ? "w-6 bg-zinc-900" : "w-2.5 bg-zinc-300/90",
                    ].join(" ")}
                  />
                ))}
              </div>
            )}

            {/* ظل سفلي لطيف */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/10 to-transparent" />
          </div>
        </section>
      </div>
    </Gallery>
  );
}
