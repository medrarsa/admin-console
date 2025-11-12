"use client";
import * as React from "react";

function pad(n: number) { return n < 10 ? `0${n}` : String(n); }

export default function SlimTimer({ endsAt }: { endsAt: string }) {
  const target = new Date(endsAt).getTime();
  const [tick, setTick] = React.useState<number>(() => Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.max(0, target - tick);
  const s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (diff <= 0) return null;

  return (
    <div className="rounded-full bg-black/80 text-white text-xs px-3 py-1.5 shadow">
      ينتهي خلال: {d}ي {pad(h)}س {pad(m)}د {pad(sec)}ث
    </div>
  );
}
