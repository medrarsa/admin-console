"use client";
import * as React from "react";

export default function SizeGuideModal() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-10 px-4 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-sm"
      >
        دليل المقاس
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-[min(96vw,680px)] max-h-[85vh] overflow-auto bg-white rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">دليل المقاس</h3>
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-800">إغلاق</button>
            </div>

            {/* محتوى مثال — بدّله لاحقًا بجدولك */}
            <table className="w-full text-left border border-zinc-200 rounded-xl overflow-hidden text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="p-2">المقاس</th>
                  <th className="p-2">الصدر (سم)</th>
                  <th className="p-2">الخصر (سم)</th>
                  <th className="p-2">الورك (سم)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["S", "86–90", "70–74", "90–94"],
                  ["M", "90–96", "74–80", "94–100"],
                  ["L", "96–102", "80–86", "100–106"],
                ].map((r, i) => (
                  <tr key={i} className="odd:bg-white even:bg-zinc-50">
                    {r.map((c, j) => <td key={j} className="p-2">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-2 text-zinc-500 text-xs">* الفروقات طبيعية ±1–2 سم.</p>
          </div>
        </div>
      )}
    </>
  );
}
