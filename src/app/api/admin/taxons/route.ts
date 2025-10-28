import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supa = await createServerSupabase();
  const { level, parentId, name } = await req.json();

  if (!level || !name) return new NextResponse("invalid body", { status: 400 });

  // احسب sort_order = آخر عنصر في الحاوية
  let q = supa.from("taxons").select("id", { count: "exact", head: true });
  if (level === "root") q = q.is("parent_id", null);
  else q = q.eq("parent_id", parentId ?? null);

  const { count, error: eCount } = await q;
  if (eCount) return new NextResponse(eCount.message, { status: 500 });

  const sort_order = count ?? 0;

  const { error } = await supa.from("taxons").insert([
    {
      level,
      parent_id: level === "root" ? null : parentId ?? null,
      name: String(name).trim(),
      sort_order,
    },
  ]);

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
