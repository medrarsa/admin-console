// src/app/(store-components)/header/StickyCategoriesTabs.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { fetchCategoriesTree } from "@/lib/store/categories";

type Seg = { id: string; name: string; slug: string };
type Sub = { id: string; name: string; slug: string; segs?: Seg[] };
type Root = { id: string; name: string; slug: string; subs?: Sub[] };

function Skel({ w }: { w: number }) {
  return (
    <span
      className="inline-block h-3 animate-pulse rounded bg-zinc-200/70"
      style={{ width: w }}
    />
  );
}

/* ====== Portal ====== */
function usePortalMounted() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted;
}

function DropdownPortal({
  anchorRect,
  children,
  onClose,
  mobileMode,
  onMouseEnterDropdown,
  onMouseLeaveDropdown,
}: {
  anchorRect: DOMRect | null;
  children: React.ReactNode;
  onClose: () => void;
  mobileMode?: boolean;
  onMouseEnterDropdown?: () => void;
  onMouseLeaveDropdown?: () => void;
}) {
  const mounted = usePortalMounted();

  React.useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onClick = (e: MouseEvent) => {
      const el = document.getElementById("__cats_dropdown__");
      if (el && !el.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onEsc);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.removeEventListener("mousedown", onClick);
    };
  }, [onClose]);

  if (!mounted || (!anchorRect && !mobileMode)) return null;

  // تموضع الدسكتوب
  const width = 300; // ✨ لمسة جيل زد: أعرض شوي
  const top = Math.round((anchorRect?.bottom ?? 0) + 12);
  const centerX = Math.round(
    ((anchorRect?.left ?? 0) + (anchorRect?.right ?? 0)) / 2
  );
  const right = Math.max(
    12,
    window.innerWidth - centerX - Math.floor(width / 2)
  ); // RTL

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 70, pointerEvents: "none" }}>
      {mobileMode && (
        <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" />
      )}

      <div
        id="__cats_dropdown__"
        onMouseEnter={onMouseEnterDropdown}
        onMouseLeave={onMouseLeaveDropdown}
        style={
          mobileMode
            ? { position: "fixed", left: 0, right: 0, bottom: 0 }
            : { position: "fixed", top, right, width }
        }
        className={[
          "pointer-events-auto rounded-2xl border border-zinc-200 bg-white p-0 shadow-2xl",
          "ring-1 ring-black/5", // ✨
          mobileMode ? "mx-auto max-w-[520px] rounded-t-3xl md:rounded-2xl" : "",
          "animate-in fade-in slide-in-from-top-2 duration-150",
        ].join(" ")}
      >
        {/* السهم العلوي */}
        {!mobileMode && (
          <>
            <span
              aria-hidden
              className="absolute -top-[10px] right-1/2 z-[2] translate-x-1/2"
              style={{
                width: 0,
                height: 0,
                borderLeft: "10px solid transparent",
                borderRight: "10px solid transparent",
                borderBottom: "10px solid rgba(0,0,0,0.06)",
              }}
            />
            <span
              aria-hidden
              className="absolute -top-[9px] right-1/2 z-[3] translate-x-1/2"
              style={{
                width: 0,
                height: 0,
                borderLeft: "9px solid transparent",
                borderRight: "9px solid transparent",
                borderBottom: "9px solid #ffffff",
              }}
            />
          </>
        )}

        {children}
      </div>
    </div>,
    document.body
  );
}

/* ====== Main ====== */
export default function StickyCategoriesTabs() {
  const [tree, setTree] = React.useState<Root[] | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);

  // refs للروابط
  const anchorRefs = React.useRef<Map<string, HTMLAnchorElement | null>>(
    new Map()
  );
  const setAnchorRef =
    (id: string) =>
    (el: HTMLAnchorElement | null): void => {
      anchorRefs.current.set(id, el);
    };

  const pathname = usePathname();
  const activeSlug = pathname?.startsWith("/categories/")
    ? pathname.split("/")[2]
    : null;

  React.useEffect(() => {
    let alive = true;
    fetchCategoriesTree()
      .then((roots: any[]) => {
        if (!alive) return;
        const mapped: Root[] = roots.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          subs: (r.subs ?? []).map((s: any) => ({
            id: s.id,
            name: s.name,
            slug: s.slug,
            segs: (s.segs ?? []).map((g: any) => ({
              id: g.id,
              name: g.name,
              slug: g.slug,
            })),
          })),
        }));
        setTree(mapped);
      })
      .catch(() => setTree([]));
    return () => {
      alive = false;
    };
  }, []);

  // Hover دسكتوب / Click موبايل
  const timer = React.useRef<number | null>(null);
  const scheduleClose = (delay = 220) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setOpenId(null);
      setAnchorRect(null);
    }, delay);
  };
  const cancelClose = () => {
    if (timer.current) window.clearTimeout(timer.current);
  };

  const onRootEnter = (root: Root) => {
    if (!root.subs?.length || window.innerWidth < 768) return;
    cancelClose();
    setOpenId(root.id);
    const el = anchorRefs.current.get(root.id);
    if (el) setAnchorRect(el.getBoundingClientRect());
  };
  const onRootLeave = () => {
    if (window.innerWidth < 768) return;
    scheduleClose(280);
  };
  const onRootClickMobile = (root: Root, e: React.MouseEvent) => {
    if (!root.subs?.length) return;
    if (window.innerWidth < 768) {
      e.preventDefault();
      if (openId === root.id) {
        setOpenId(null);
        setAnchorRect(null);
      } else {
        setOpenId(root.id);
        setAnchorRect(null); // bottom sheet
      }
    }
  };

  const handleDropdownEnter = () => cancelClose();
  const handleDropdownLeave = () => scheduleClose(220);

  const mobileMode =
    typeof window !== "undefined" ? window.innerWidth < 768 : false;

  return (
    <div
      className="sticky top-0 z-50 border-b border-zinc-200/70 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70"
      style={{ minHeight: 48 }}
    >
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex h-12 items-center justify-center">
          <div className="select-none">
            <nav className="flex items-center justify-center gap-4 sm:gap-6 py-0.5 text-[13px] sm:text-sm min-h-[28px]">
              {tree === null ? (
                <div className="flex items-center gap-5">
                  <Skel w={52} />
                  <Skel w={68} />
                  <Skel w={56} />
                  <Skel w={74} />
                  <Skel w={60} />
                </div>
              ) : (
                tree.map((root) => {
                  const isActive = activeSlug === root.slug;
                  const hasSubs = !!root.subs && root.subs.length > 0;

                  return (
                    <div
                      key={root.id}
                      className="relative"
                      onMouseEnter={() => onRootEnter(root)}
                      onMouseLeave={onRootLeave}
                    >
                      <Link
                        ref={setAnchorRef(root.id)}
                        href={`/categories/${encodeURIComponent(root.slug)}`}
                        title={root.slug}
                        onClick={(e) => onRootClickMobile(root, e)}
                        className={[
                          // ✨ كبسولة أنيقة + ميكرو-انيميشن
                          "group relative inline-flex items-center whitespace-nowrap rounded-full px-3 py-1.5 transition-all",
                          "outline-none ring-0 focus-visible:ring-2 focus-visible:ring-[#f1fe2b] focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                          isActive
                            ? "text-[#130342] font-semibold"
                            : "text-zinc-700 hover:text-zinc-900",
                          // لمسة خلفية عند الهوفر
                          "hover:shadow-sm hover:bg-zinc-50",
                        ].join(" ")}
                      >
                        {/* dot صغيرة تطلع على الهوفر */}
                        <span className="absolute -right-1 -top-1 hidden h-1.5 w-1.5 rounded-full bg-black opacity-0 transition-all group-hover:opacity-100 md:block" />
                        <span className="relative z-[1]">{root.name}</span>

                        {/* underline أنيميت أسود */}
                        <span
                          className={[
                            "absolute inset-x-3 -bottom-0.5 mx-auto h-[2px] w-0 rounded-full transition-all duration-200",
                            isActive
                              ? "w-8 bg-black"
                              : "group-hover:w-8 group-hover:bg-black",
                          ].join(" ")}
                        />

                        {/* هالة رقيقة على الهوفر (جيل زد) */}
                        <span className="absolute inset-0 -z-10 rounded-full bg-[#f1fe2b]/10 opacity-0 transition group-hover:opacity-100" />
                      </Link>

                      {/* لا نعرض المنسدلة هنا؛ تظل عبر الـ Portal فقط */}
                      {hasSubs && null}
                    </div>
                  );
                })
              )}
            </nav>
          </div>
        </div>
      </div>

      {/* المنسدلة عبر الـ Portal */}
      {tree && openId && (
        <DropdownPortal
          anchorRect={mobileMode ? null : anchorRect}
          onClose={() => {
            setOpenId(null);
            setAnchorRect(null);
          }}
          mobileMode={mobileMode}
          onMouseEnterDropdown={handleDropdownEnter}
          onMouseLeaveDropdown={handleDropdownLeave}
        >
          {(() => {
            const root = tree.find((r) => r.id === openId)!;

            return (
              <div className="max-h-[70vh] overflow-auto rounded-2xl no-scrollbar">
                <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-3 py-2">
                  <div className="text-sm font-semibold text-zinc-800">
                    {root.name}
                  </div>
                  {/* شريحة تمييز بسيطة */}
                  <span className="hidden md:inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] text-zinc-600">
                    تصنيفات فرعية
                  </span>
                </div>

                <ul className="py-1">
                  {root.subs?.map((sub) => (
                    <li key={sub.id} className="group/sub">
                      <Link
                        href={`/categories/${encodeURIComponent(
                          root.slug
                        )}?sub=${encodeURIComponent(sub.slug)}`}
                        title={sub.slug}
                        className="block px-3 py-2 text-[13px] text-zinc-800 hover:bg-zinc-50 rounded-lg transition"
                      >
                        {sub.name}
                      </Link>

                      {sub.segs && sub.segs.length > 0 && (
                        <ul className="mb-1">
                          {sub.segs.map((g) => (
                            <li key={g.id}>
                              <Link
                                href={`/categories/${encodeURIComponent(
                                  root.slug
                                )}?sub=${encodeURIComponent(
                                  sub.slug
                                )}#${encodeURIComponent(g.slug)}`}
                                title={g.slug}
                                className="block px-6 py-1.5 text-[12px] text-zinc-600 hover:bg-zinc-50 rounded-lg transition"
                              >
                                {g.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="border-t border-zinc-200 p-2 md:hidden">
                  <button
                    onClick={() => {
                      setOpenId(null);
                      setAnchorRect(null);
                    }}
                    className="w-full rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-zinc-50 active:scale-[0.99]"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            );
          })()}
        </DropdownPortal>
      )}
    </div>
  );
}
