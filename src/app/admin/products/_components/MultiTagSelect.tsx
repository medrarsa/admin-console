// src/app/admin/products/_components/MultiTagSelect.tsx
"use client";

import * as React from "react";
import { Tag, ChevronDown } from "lucide-react";

/** بدائل افتراضية للخيارات */
const DEFAULT_SUGGESTIONS = ["عام (مخفي)", "عروض "];

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Props = {
  selected: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
};

export default function MultiTagSelect({
  selected,
  onChange,
  suggestions = DEFAULT_SUGGESTIONS,
  placeholder = "أضف تصنيف",
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [hoverIndex, setHoverIndex] = React.useState<number>(-1);

  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  /** اقتراحات مفلترة مع استبعاد المختار */
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return suggestions.filter(
      (s) => !selected.includes(s) && (!q || s.toLowerCase().includes(q))
    );
  }, [suggestions, selected, query]);

  const canCreate =
    query.trim().length > 0 &&
    !selected.includes(query.trim()) &&
    !suggestions.includes(query.trim());

  /** إغلاق عند النقر خارج/ESC */
  React.useEffect(() => {
    function handleDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleDocClick);
      document.addEventListener("keydown", handleEsc);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  /** إضافة قيمة جديدة */
  const add = (val: string) => {
    const v = val.trim();
    if (!v || selected.includes(v)) return;
    onChange([...selected, v]);
    setQuery("");
    setHoverIndex(-1);
    setOpen(false);
  };

  /** كيبورد */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const max = filtered.length + (canCreate ? 1 : 0) - 1;
      setHoverIndex((idx) => Math.min(idx + 1, max));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHoverIndex((idx) => Math.max(idx - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (canCreate && hoverIndex === 0) return add(query);
      const idxInList = hoverIndex - (canCreate ? 1 : 0);
      if (idxInList >= 0 && idxInList < filtered.length)
        return add(filtered[idxInList]);
      if (canCreate) add(query);
    }
  };

  return (
    <div
      ref={wrapRef}
      className="relative z-[10000]"
      style={{ overflow: "visible" }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "inline-flex w-full items-center justify-between rounded-2xl",
          "border border-zinc-200/70 bg-white/80 px-3 py-2 text-[13px] text-zinc-700",
          "shadow-sm transition hover:bg-zinc-50/80 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="inline-flex items-center gap-2">
          <Tag className="h-4 w-4 text-zinc-600" />
          {placeholder}
        </span>
        <ChevronDown
          className={cx(
            "h-4 w-4 text-zinc-500 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {/* القائمة */}
      {open && (
        <div
          role="listbox"
          className={cx(
            "absolute z-[5000] mt-1 w-full overflow-hidden rounded-2xl",
            "border border-white/30 bg-white/90 backdrop-blur-md ring-1 ring-black/5",
            "shadow-[0_20px_50px_-12px_rgba(0,0,0,.25)]"
          )}
          style={{ top: "100%", left: 0 }}
        >
          {/* البحث */}
          <div className="border-b border-zinc-200/70 bg-white/80 px-2 py-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHoverIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              placeholder="ابحث أو اكتب لإضافة"
              className={cx(
                "w-full rounded-xl border border-zinc-200/70 bg-white/80 px-3 py-2 text-sm",
                "outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/40 transition"
              )}
            />
          </div>

          {/* الاقتراحات */}
          <div className="no-scrollbar max-h-60 overflow-y-auto bg-white/80">
            {canCreate && (
              <button
                type="button"
                onMouseEnter={() => setHoverIndex(0)}
                onClick={() => add(query)}
                className={cx(
                  "block w-full text-start px-3 py-2 text-sm transition",
                  hoverIndex === 0
                    ? "bg-teال-50 text-teal-800"
                    : "hover:bg-zinc-50/80"
                )}
              >
                إضافة: “{query.trim()}”
              </button>
            )}

            {filtered.length === 0 && !canCreate ? (
              <div className="px-3 py-3 text-center text-xs text-zinc-500">
                لا توجد نتائج.
              </div>
            ) : (
              filtered.map((s, i) => {
                const idx = canCreate ? i + 1 : i;
                return (
                  <button
                    key={s}
                    type="button"
                    onMouseEnter={() => setHoverIndex(idx)}
                    onClick={() => add(s)}
                    className={cx(
                      "block w-full text-start px-3 py-2 text-sm transition",
                      hoverIndex === idx
                        ? "bg-teal-50 text-teal-800"
                        : "hover:bg-zinc-50/80"
                    )}
                  >
                    {s}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
