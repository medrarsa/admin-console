import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/** body: { id: string, toLevel: "root"|"sub"|"seg", targetParentId?: string|null, position?: number } */
export async function PATCH(req: Request) {
  const supa = await createServerSupabase();
  const {
    id,
    toLevel,
    targetParentId = null,
    position = null,
  } = await req.json();

  if (!id || !toLevel) return new NextResponse("invalid body", { status: 400 });

  // عدّل المستوى والأب
  const { error: e1 } = await supa
    .from("taxons")
    .update({
      level: toLevel,
      parent_id: toLevel === "root" ? null : targetParentId ?? null,
    })
    .eq("id", id);

  if (e1) return new NextResponse(e1.message, { status: 500 });

  // اضبط sort_order داخل الحاوية الجديدة إن أُرسلت position
  if (position !== null && position !== undefined) {
    let q = supa
      .from("taxons")
      .select("id")
      .order("sort_order", { ascending: true });
    const parentId = toLevel === "root" ? null : targetParentId ?? null;

    if (parentId) q = q.eq("parent_id", parentId);
    else q = q.is("parent_id", null);

    const { data, error } = await q;
    if (error) return new NextResponse(error.message, { status: 500 });

    const ids = (data ?? []).map((r) => r.id as string).filter((x) => x !== id);
    const insertAt = Math.max(0, Math.min(Number(position), ids.length));
    ids.splice(insertAt, 0, id);

    for (let i = 0; i < ids.length; i++) {
      const { error: e2 } = await supa
        .from("taxons")
        .update({ sort_order: i })
        .eq("id", ids[i]);
      if (e2) return new NextResponse(e2.message, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
