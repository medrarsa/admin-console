import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

type Taxon = {
  id: string;
  parent_id: string | null;
  level: "root" | "sub" | "seg";
  name: string;
  sort_order: number;
};

export async function GET() {
  const supa = await createServerSupabase();

  const { data, error } = await supa
    .from("taxons")
    .select("id,parent_id,level,name,sort_order")
    .order("sort_order", { ascending: true });

  if (error) return new NextResponse(error.message, { status: 500 });
  const all = (data ?? []) as Taxon[];

  const byParent: Record<string, Taxon[]> = {};
  for (const t of all) {
    const key = t.parent_id ?? "root";
    (byParent[key] ??= []).push(t);
  }

  const roots = (byParent["root"] ?? []).filter((t) => t.level === "root");

  const buildSubs = (parentId: string) =>
    (byParent[parentId] ?? [])
      .filter((t) => t.level === "sub")
      .sort((a, b) => a.sort_order - b.sort_order);

  const buildSegs = (parentId: string) =>
    (byParent[parentId] ?? [])
      .filter((t) => t.level === "seg")
      .sort((a, b) => a.sort_order - b.sort_order);

  const tree = roots
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((root) => ({
      id: root.id,
      name: root.name,
      sort_order: root.sort_order,
      level: "root" as const,
      children: buildSubs(root.id).map((sub) => ({
        id: sub.id,
        name: sub.name,
        sort_order: sub.sort_order,
        level: "sub" as const,
        children: buildSegs(sub.id).map((seg) => ({
          id: seg.id,
          name: seg.name,
          sort_order: seg.sort_order,
          level: "seg" as const,
        })),
      })),
    }));

  return NextResponse.json(tree);
}
