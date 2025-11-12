import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/** body: { id: string, newParentId: string|null, newIndex?: number } */
export async function PATCH(req: Request) {
  const supa = await createServerSupabase();
  const { id, newParentId, newIndex } = await req.json();

  if (!id) return new NextResponse("invalid body", { status: 400 });

  // حدّث الأب
  {
    const { error } = await supa
      .from("taxons")
      .update({ parent_id: newParentId ?? null })
      .eq("id", id);
    if (error) return new NextResponse(error.message, { status: 500 });
  }

  // اجلب IDs مرتبة في الحاوية الهدف ثم ضع العنصر في موضعه
  let q = supa
    .from("taxons")
    .select("id")
    .order("sort_order", { ascending: true });
  if (newParentId) q = q.eq("parent_id", newParentId);
  else q = q.is("parent_id", null);

  const { data, error } = await q;
  if (error) return new NextResponse(error.message, { status: 500 });

  const ids = (data ?? []).map((r) => r.id as string).filter((x) => x !== id);
  const insertAt = Number.isFinite(newIndex)
    ? Math.max(0, Math.min(Number(newIndex), ids.length))
    : ids.length;
  ids.splice(insertAt, 0, id);

  for (let i = 0; i < ids.length; i++) {
    const { error: e2 } = await supa
      .from("taxons")
      .update({ sort_order: i })
      .eq("id", ids[i]);
    if (e2) return new NextResponse(e2.message, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
