// src/app/(store-components)/products/OptionValuesTable.tsx
"use client";
import * as React from "react";

type PickerValue = { id: string; label: string };
type PickerGroup = { id: string; name: string; values: PickerValue[] };

export default function OptionValuesTable({
  groups,
}: {
  groups: PickerGroup[];
}) {
  // نفرد القيم على شكل صفوف: (value_id, value_name, group_name)
  const rows = (groups || [])
    .flatMap((g) =>
      (g.values || []).map((v) => ({
        group_name: g.name,
        value_id: v.id,
        value_name: v.label,
      }))
    )
    .sort((a, b) => {
      const byGroup = a.group_name.localeCompare(b.group_name, "ar");
      return byGroup !== 0
        ? byGroup
        : a.value_name.localeCompare(b.value_name, "ar");
    });

  if (!rows.length) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <div className="border-b px-3 py-2 text-sm font-medium">
        جدول المقاسات/القيم
      </div>
      <table className="min-w-full text-sm">
        <thead className="bg-zinc-50 text-zinc-600">
          <tr>
            <th className="px-3 py-2 text-right">group_name</th>
            <th className="px-3 py-2 text-right">value_id</th>
            <th className="px-3 py-2 text-right">value_name</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.value_id} className="border-t">
              <td className="px-3 py-2">{r.group_name}</td>
              <td className="px-3 py-2">{r.value_id}</td>
              <td className="px-3 py-2">{r.value_name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
