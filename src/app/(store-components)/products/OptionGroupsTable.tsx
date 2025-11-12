// src/app/(store-components)/products/OptionGroupsTable.tsx
"use client";
import * as React from "react";

type PickerValue = { id: string; label: string };
type PickerGroup = {
  id: string;
  name: string;
  kind: "choice" | "addon"; // radio => choice, checkbox => addon
  values: PickerValue[];
};

export default function OptionGroupsTable({
  groups,
}: {
  groups: PickerGroup[];
}) {
  const rows = (groups || [])
    .map((g) => ({
      option_id: g.id,
      group_name: g.name,
      type: g.kind === "choice" ? "radio" : "checkbox",
      values_count: g.values?.length ?? 0,
    }))
    .sort((a, b) => a.group_name.localeCompare(b.group_name, "ar"));

  if (!rows.length) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <div className="border-b px-3 py-2 text-sm font-medium">
        جدول المجموعات
      </div>
      <table className="min-w-full text-sm">
        <thead className="bg-zinc-50 text-zinc-600">
          <tr>
            <th className="px-3 py-2 text-right">option_id</th>
            <th className="px-3 py-2 text-right">group_name</th>
            <th className="px-3 py-2 text-right">type</th>
            <th className="px-3 py-2 text-right">values_count</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.option_id} className="border-t">
              <td className="px-3 py-2">{r.option_id}</td>
              <td className="px-3 py-2">{r.group_name}</td>
              <td className="px-3 py-2">{r.type}</td>
              <td className="px-3 py-2">{r.values_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
