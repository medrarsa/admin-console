import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/admin/catalog/drag
 * body:
 * {
 *   node: { id: string, type: "category"|"subcategory"|"segment" },
 *   dropTarget: { id: string|null, type: "category"|"subcategory"|null }, // null => جذر
 *   position: { mode: "inside"|"before"|"after", index?: number }
 * }
 *
 * هذا الراوت يقرر تلقائياً:
 * - inside  + نفس المستوى => move (sub↔sub أو seg↔seg)
 * - before/after داخل نفس الحاوية => reorder
 * - inside مع اختلاف مستوى => convert
 */
type NodeType = "category" | "subcategory" | "segment";
type Mode = "inside" | "before" | "after";

type DragBody = {
  node: { id: string; type: NodeType };
  dropTarget: { id: string | null; type: NodeType | null };
  position: { mode: Mode; index?: number };
};

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const body = (await req.json()) as DragBody;
  const { node, dropTarget, position } = body;

  // Helpers
  const toLevel = (t: NodeType | null) =>
    t === "category"
      ? "root"
      : t === "subcategory"
      ? "sub"
      : t === "segment"
      ? "seg"
      : "root";

  const levelOfNode = toLevel(node.type);
  const levelOfTarget = toLevel(dropTarget?.type ?? null);

  const isSameLevel =
    (levelOfNode === "root" && levelOfTarget === "root") ||
    (levelOfNode === "sub" && levelOfTarget === "sub") ||
    (levelOfNode === "seg" && levelOfTarget === "seg");

  // 1) reorder داخل نفس الحاوية (before/after)
  if (position.mode === "before" || position.mode === "after") {
    // نحتاج قائمة IDs لحاوية الهدف
    const { parentCol, table, parentId } = await resolveContainerForTarget(
      supabase,
      levelOfNode,
      dropTarget
    );
    if (!table) return new NextResponse("bad target", { status: 400 });

    // أخرج IDs مرتبة
    let q = supabase
      .from(table)
      .select("id")
      .order("sort_order", { ascending: true });
    if (parentId !== undefined && parentId !== null)
      q = q.eq(parentCol!, parentId);
    else if (levelOfNode === "sub") q = q.is(parentCol!, null); // إن كان null مسموح

    const { data: rows, error } = await q;
    if (error) return new NextResponse(error.message, { status: 500 });

    // ضع العنصر قبل/بعد الهدف
    const ids = (rows ?? [])
      .map((r) => r.id as string)
      .filter((x) => x !== node.id);
    const idx = ids.findIndex((x) => x === (dropTarget?.id ?? ""));
    const insertAt =
      idx < 0 ? ids.length : position.mode === "before" ? idx : idx + 1;
    ids.splice(insertAt, 0, node.id);

    for (let i = 0; i < ids.length; i++) {
      const { error: e2 } = await supabase
        .from(table)
        .update({ sort_order: i })
        .eq("id", ids[i]);
      if (e2) return new NextResponse(e2.message, { status: 500 });
    }
    return NextResponse.json({ ok: true, kind: "reorder" });
  }

  // 2) inside
  if (position.mode === "inside") {
    // داخل نفس المستوى => move
    if (isSameLevel) {
      // newParent = الحاوية الهدف
      const newParent = await resolveContainerForTarget(
        supabase,
        levelOfNode,
        dropTarget
      );
      if (!newParent.table)
        return new NextResponse("bad target", { status: 400 });

      // احسب index (آخر القائمة إن لم يُرسل)
      let q = supabase
        .from(newParent.table)
        .select("id")
        .order("sort_order", { ascending: true });
      if (newParent.parentId !== undefined && newParent.parentId !== null)
        q = q.eq(newParent.parentCol!, newParent.parentId);
      else if (levelOfNode === "sub") q = q.is(newParent.parentCol!, null);

      const { data: rows, error } = await q;
      if (error) return new NextResponse(error.message, { status: 500 });

      const ids = (rows ?? [])
        .map((r) => r.id as string)
        .filter((x) => x !== node.id);
      const insertAt = Number.isFinite(position.index)
        ? Math.max(0, Math.min(Number(position.index), ids.length))
        : ids.length;
      ids.splice(insertAt, 0, node.id);

      // حدّث الأب
      const table =
        levelOfNode === "sub"
          ? "subcategories"
          : levelOfNode === "seg"
          ? "segments"
          : "categories";
      const parentCol =
        levelOfNode === "sub"
          ? "category_id"
          : levelOfNode === "seg"
          ? "subcategory_id"
          : undefined;
      if (parentCol) {
        const { error: e } = await supabase
          .from(table)
          .update({ [parentCol]: newParent.parentId ?? null })
          .eq("id", node.id);
        if (e) return new NextResponse(e.message, { status: 500 });
      }

      // رصّ الترتيب
      for (let i = 0; i < ids.length; i++) {
        const { error: e2 } = await supabase
          .from(newParent.table)
          .update({ sort_order: i })
          .eq("id", ids[i]);
        if (e2) return new NextResponse(e2.message, { status: 500 });
      }
      return NextResponse.json({ ok: true, kind: "move" });
    }

    // اختلاف مستوى => convert
    const payload = {
      from: levelOfNode,
      to: levelOfTarget,
      id: node.id,
      targetParentId: levelOfTarget === "root" ? null : dropTarget?.id ?? null,
      position: Number.isFinite(position.index) ? Number(position.index) : null,
      withChildren: true,
    };

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/admin/catalog/convert`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const msg = await res.text();
      return new NextResponse(msg || "convert failed", { status: res.status });
    }
    return NextResponse.json({ ok: true, kind: "convert" });
  }

  return new NextResponse("unsupported mode", { status: 400 });
}

/** يحوّل dropTarget إلى معلومات الحاوية (جدول + عمود الأب + id الأب) */
async function resolveContainerForTarget(
  _supabase: any,
  levelOfNode: "root" | "sub" | "seg",
  dropTarget: { id: string | null; type: NodeType | null } | null
): Promise<{
  table?: "categories" | "subcategories" | "segments";
  parentCol?: "category_id" | "subcategory_id";
  parentId?: string | null;
}> {
  if (levelOfNode === "root") {
    // حاوية الروت هي categories نفسها (parentId = null)
    return { table: "categories", parentId: null };
  }
  if (levelOfNode === "sub") {
    // حاوية sub هي category الذي تُسقط بداخله
    const catId = dropTarget?.id ?? null; // null => حاوية فارغة (لو DB يسمح)
    return {
      table: "subcategories",
      parentCol: "category_id",
      parentId: catId,
    };
  }
  // seg
  const subId = dropTarget?.id ?? null;
  return { table: "segments", parentCol: "subcategory_id", parentId: subId };
}
