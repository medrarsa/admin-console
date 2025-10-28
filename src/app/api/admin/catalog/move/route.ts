import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * PATCH /api/admin/catalog/move
 * body: {
 *   level: "sub" | "seg",
 *   id: string,
 *   newParentId: string | null,
 *   newIndex?: number
 * }
 */
export async function PATCH(req: Request) {
  const supabase = await createServerSupabase();

  // 1) اقرأ الجسم وطبّع القيم
  const raw = await req.json().catch(() => ({}));
  const level = raw?.level as ("sub" | "seg") | undefined;
  const id = raw?.id as string | undefined;
  const newParentId = (raw?.newParentId ?? null) as string | null;
  const newIndex =
    typeof raw?.newIndex === "number" && Number.isFinite(raw.newIndex)
      ? (raw.newIndex as number)
      : null; // null => أضفه آخر القائمة

  if (!id || (level !== "sub" && level !== "seg")) {
    return new NextResponse("invalid body", { status: 400 });
  }

  const table = level === "sub" ? "subcategories" : "segments";
  const parentCol = level === "sub" ? "category_id" : "subcategory_id";

  // 2) التقاط الأب القديم قبل التحديث (مع typing صريح)
  type RowSub = { category_id: string | null; sort_order: number };
  type RowSeg = { subcategory_id: string | null; sort_order: number };

  const selCols =
    level === "sub" ? "category_id, sort_order" : "subcategory_id, sort_order";

  const { data: currentRow, error: readErr } = await supabase
    .from(table)
    .select(selCols)
    .eq("id", id)
    .maybeSingle<RowSub | RowSeg>();

  if (readErr) return new NextResponse(readErr.message, { status: 500 });
  if (!currentRow) return new NextResponse("not found", { status: 404 });

  const oldParentId: string | null =
    level === "sub"
      ? (currentRow as RowSub).category_id
      : (currentRow as RowSeg).subcategory_id;

  const movingInsideSameParent = oldParentId === newParentId;

  // 3) حدّث الأب الجديد
  {
    const { error } = await supabase
      .from(table)
      .update({ [parentCol]: newParentId })
      .eq("id", id);
    if (error) return new NextResponse(error.message, { status: 500 });
  }

  // 4) أعِد ترتيب حاوية "الهدف"
  {
    let q = supabase.from(table).select("id").order("sort_order", {
      ascending: true,
    });

    if (newParentId !== null) {
      q = q.eq(parentCol, newParentId);
    } else if (level === "sub") {
      // استخدم هذا فقط إذا كان مسموحًا أن تكون subcategories بدون category_id
      q = q.is(parentCol, null);
    }

    const { data: targetRows, error: tgtErr } = await q;
    if (tgtErr) return new NextResponse(tgtErr.message, { status: 500 });

    const ids = (targetRows ?? [])
      .map((r) => r.id as string)
      .filter((x) => x !== id);

    const insertAt =
      newIndex === null
        ? ids.length
        : Math.max(0, Math.min(newIndex, ids.length));
    ids.splice(insertAt, 0, id);

    for (let i = 0; i < ids.length; i++) {
      const { error: updErr } = await supabase
        .from(table)
        .update({ sort_order: i })
        .eq("id", ids[i]);
      if (updErr) return new NextResponse(updErr.message, { status: 500 });
    }
  }

  // 5) أعِد ترتيب حاوية "المصدر" لو تغيّر الأب
  if (!movingInsideSameParent) {
    let qs = supabase.from(table).select("id").order("sort_order", {
      ascending: true,
    });

    if (oldParentId !== null) {
      qs = qs.eq(parentCol, oldParentId);
    } else if (level === "sub") {
      // فقط إذا كان null مسموح
      qs = qs.is(parentCol, null);
    }

    const { data: srcRows, error: srcErr } = await qs;
    if (srcErr) return new NextResponse(srcErr.message, { status: 500 });

    const srcIds = (srcRows ?? []).map((r) => r.id as string);
    for (let i = 0; i < srcIds.length; i++) {
      const { error: upd2Err } = await supabase
        .from(table)
        .update({ sort_order: i })
        .eq("id", srcIds[i]);
      if (upd2Err) return new NextResponse(upd2Err.message, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
