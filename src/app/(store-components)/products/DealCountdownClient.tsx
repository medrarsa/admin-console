// src/app/(store-components)/products/DealCountdownClient.tsx
"use client";
import * as React from "react";

function fmt(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function diff(endsAt: string) {
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  const ms = Math.max(0, end - now);
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return { d, h, m, sec, done: ms <= 0 };
}

export default function DealCountdownClient({ endsAt }: { endsAt: string }) {
  // لا نحسب شيء أثناء SSR — نُظهر Placeholder ثابت
  const [mounted, setMounted] = React.useState(false);
  const [t, setT] = React.useState(() => ({
    d: 0,
    h: 0,
    m: 0,
    sec: 0,
    done: false,
  }));

  React.useEffect(() => {
    setMounted(true); // يبدأ العد بعد الـ mount
    const tick = () => setT(diff(endsAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  // Placeholder ثابت أثناء SSR لمنع عدم التطابق
  if (!mounted) {
    return (
      <div className="flex gap-2 text-xs text-zinc-500" aria-hidden="true">
        <span className="rounded-lg bg-zinc-100 px-2 py-1">--</span>
        <span className="rounded-lg bg-zinc-100 px-2 py-1">--</span>
        <span className="rounded-lg bg-zinc-100 px-2 py-1">--</span>
        <span className="rounded-lg bg-zinc-100 px-2 py-1">--</span>
      </div>
    );
  }

  if (t.done) return null;

  return (
    <div className="flex gap-2 text-sm">
      <Box label="d">{fmt(t.d)}</Box>
      <Box label="h">{fmt(t.h)}</Box>
      <Box label="m">{fmt(t.m)}</Box>
      <Box label="s">{fmt(t.sec)}</Box>
    </div>
  );
}

function Box({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex w-12 items-center justify-center rounded-lg bg-gray-100 font-semibold text-gray-900">
      <div className="py-2 text-center leading-tight">
        <div>{children}</div>
        <div className="text-[10px] font-normal text-gray-500">{label}</div>
      </div>
    </div>
  );
}
