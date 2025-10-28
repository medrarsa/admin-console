// src/app/api/admin/taxons/tree/route.ts
import { NextResponse } from "next/server";
 
import { createServerSupabase } from "@/lib/supabase/server";
type TaxonRow = {
  id: string;
  parent_id: string | null;
  level: "root" | "sub" | "seg";
  name: string;
  sort_order: number;
  status: "active" | "hidden";
  hide_products: boolean | null;
  image: string | null;
  archived_at: string | null;
};

export async function GET() {
  const supa = await createServerSupabase();

  const { data, error } = await supa
    .from("taxons")
    .select(
      "id,parent_id,level,name,sort_order,status,hide_products,image,archived_at"
    )
    .order("sort_order", { ascending: true });

  if (error) return new NextResponse(error.message, { status: 500 });

  const rows = (data ?? []).filter((r) => !r.archived_at) as TaxonRow[];

  const byParent: Record<string, TaxonRow[]> = {};
  for (const t of rows) {
    const key = t.parent_id ?? "root";
    (byParent[key] ??= []).push(t);
  }

  const mapSegs = (parentId: string) =>
    (byParent[parentId] ?? [])
      .filter((t) => t.level === "seg")
      .map((g) => ({
        id: g.id,
        name: g.name,
        sort_order: g.sort_order,
        level: g.level,
        status: g.status,
        hide_products: !!g.hide_products,
        image: g.image,
      }));

  const mapSubs = (parentId: string) =>
    (byParent[parentId] ?? [])
      .filter((t) => t.level === "sub")
      .map((s) => ({
        id: s.id,
        name: s.name,
        sort_order: s.sort_order,
        level: s.level,
        status: s.status,
        hide_products: !!s.hide_products,
        image: s.image,
        children: mapSegs(s.id),
      }));

  const roots = (byParent["root"] ?? [])
    .filter((t) => t.level === "root")
    .map((r) => ({
      id: r.id,
      name: r.name,
      sort_order: r.sort_order,
      level: r.level,
      status: r.status,
      hide_products: !!r.hide_products,
      image: r.image,
      children: mapSubs(r.id),
    }));

  return NextResponse.json(roots);
}
