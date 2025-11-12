import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/* ===== Helpers ===== */
function slugify(input: string) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/\-+/g, "-");
}

async function uniqSlug(
  supabase: any,
  table: "categories" | "subcategories" | "segments",
  base: string
) {
  let slug = base || "item";
  let i = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("id")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) break;
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
}

async function listSegIdsUnder(
  supabase: any,
  from: "root" | "sub" | "seg",
  id: string
): Promise<{ segIds: string[]; name: string; subIds: string[] }> {
  let segIds: string[] = [];
  let subIds: string[] = [];
  let name = "";

  if (from === "root") {
    const { data: cat, error } = await supabase
      .from("categories")
      .select("id,name")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!cat) throw new Error("NOT_FOUND");
    name = cat.name;

    const { data: subs } = await supabase
      .from("subcategories")
      .select("id")
      .eq("category_id", id);
    subIds = (subs ?? []).map((s: any) => s.id);

    if (subIds.length) {
      const { data: segs } = await supabase
        .from("segments")
        .select("id")
        .in("subcategory_id", subIds);
      segIds = (segs ?? []).map((g: any) => g.id);
    }
  } else if (from === "sub") {
    const { data: sub, error } = await supabase
      .from("subcategories")
      .select("id,name")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!sub) throw new Error("NOT_FOUND");
    name = sub.name;

    const { data: segs } = await supabase
      .from("segments")
      .select("id")
      .eq("subcategory_id", id);
    segIds = (segs ?? []).map((g: any) => g.id);
  } else {
    const { data: seg, error } = await supabase
      .from("segments")
      .select("id,name,subcategory_id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!seg) throw new Error("NOT_FOUND");
    name = seg.name;
    segIds = [id];
  }

  return { segIds, name, subIds };
}

async function countProductsForSegments(supabase: any, segmentIds: string[]) {
  if (!segmentIds.length) return 0;
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .in("segment_id", segmentIds);
  if (error) throw error;
  return count ?? 0;
}

/**
 * PATCH body:
 * {
 *   from: "root" | "sub" | "seg",
 *   to:   "root" | "sub" | "seg",
 *   id: string,
 *   targetParentId: string | null,
 *   position?: number,
 *   withChildren?: boolean,
 *   force?: boolean   // يسمح بالسحب الحر حتى لو فيه منتجات مربوطة
 * }
 */
export async function PATCH(req: Request) {
  const supabase = await createServerSupabase();
  const body = await req.json();
  const {
    from,
    to,
    id,
    targetParentId = null,
    position,
    withChildren = true,
    force = true, // نجعلها افتراضيًا true لتحريك حر
  } = body ?? {};

  if (!from || !to || !id) {
    return new NextResponse("bad request", { status: 400 });
  }
  if (from === to)
    return NextResponse.json({ ok: true, note: "no level change" });

  // 1) جهّز معلومات المصدر (اجمع segIds قبل أي تعديل)
  let name = "";
  let subIds: string[] = [];
  let segIds: string[] = [];
  try {
    const info = await listSegIdsUnder(supabase, from, id);
    name = info.name;
    segIds = info.segIds;
    subIds = info.subIds;
  } catch (e: any) {
    if (e?.message === "NOT_FOUND")
      return new NextResponse("not found", { status: 404 });
    return new NextResponse(e?.message || "failed", { status: 500 });
  }

  // 2) احسب sort_order للوجهة
  async function nextOrder(): Promise<number> {
    if (to === "root") {
      const { count } = await supabase
        .from("categories")
        .select("id", { count: "exact", head: true });
      return typeof position === "number" ? position : count ?? 0;
    }
    if (to === "sub") {
      if (!targetParentId) throw new Error("targetParentId required for sub");
      const { count } = await supabase
        .from("subcategories")
        .select("id", { count: "exact", head: true })
        .eq("category_id", targetParentId);
      return typeof position === "number" ? position : count ?? 0;
    }
    if (!targetParentId) throw new Error("targetParentId required for seg");
    const { count } = await supabase
      .from("segments")
      .select("id", { count: "exact", head: true })
      .eq("subcategory_id", targetParentId);
    return typeof position === "number" ? position : count ?? 0;
  }
  const sort_order = await nextOrder();
  const toTable: "categories" | "subcategories" | "segments" =
    to === "root" ? "categories" : to === "sub" ? "subcategories" : "segments";
  const base = slugify(name);
  const slug = await uniqSlug(supabase, toTable, base);

  // 3) أنشئ الوجهة (container) + جهّز segment لإعادة ربط المنتجات عليه
  let newContainerId: string | null = null;
  let relinkToSegmentId: string | null = null;

  if (to === "root") {
    const { data, error } = await supabase
      .from("categories")
      .insert([{ name, slug, sort_order }])
      .select("id")
      .single();
    if (error) return new NextResponse(error.message, { status: 500 });
    newContainerId = data.id;
  } else if (to === "sub") {
    if (!targetParentId)
      return new NextResponse("targetParentId required", { status: 400 });
    const { data, error } = await supabase
      .from("subcategories")
      .insert([{ name, slug, sort_order, category_id: targetParentId }])
      .select("id")
      .single();
    if (error) return new NextResponse(error.message, { status: 500 });
    newContainerId = data.id;
  } else {
    if (!targetParentId)
      return new NextResponse("targetParentId required", { status: 400 });
    const { data, error } = await supabase
      .from("segments")
      .insert([{ name, slug, sort_order, subcategory_id: targetParentId }])
      .select("id")
      .single();
    if (error) return new NextResponse(error.message, { status: 500 });
    newContainerId = data.id;
    relinkToSegmentId = data.id; // تحويل مباشر إلى seg
  }

  // 4) إن كان في منتجات والـ force مفعّل: أنشئ/حدّد Segment تجميعي بالوجهة أولاً
  const prodCount = await countProductsForSegments(supabase, segIds);
  if (force && prodCount > 0 && !relinkToSegmentId) {
    if (to === "sub" && newContainerId) {
      const segSlug = await uniqSlug(
        supabase,
        "segments",
        slugify(`${name}-placeholder`)
      );
      const { data: createdSeg, error: e } = await supabase
        .from("segments")
        .insert([
          {
            name: `${name} — مجمّع`,
            slug: segSlug,
            sort_order: 0,
            subcategory_id: newContainerId,
          },
        ])
        .select("id")
        .single();
      if (e) return new NextResponse(e.message, { status: 500 });
      relinkToSegmentId = createdSeg.id;
    }
    if (to === "root" && newContainerId) {
      // نحول sub→root: سنرقي السيغمنتات لاحقاً؛ خذ أول sub سيتم إنشاؤه لاحقاً
      // ننشئ Sub أولي + Seg placeholder عليه قبل الحذف
      const sSlug = await uniqSlug(
        supabase,
        "subcategories",
        slugify(`${name}-container`)
      );
      const { data: firstSub, error: e1 } = await supabase
        .from("subcategories")
        .insert([
          {
            name: `${name} — حاوية`,
            slug: sSlug,
            sort_order: 0,
            category_id: newContainerId,
          },
        ])
        .select("id")
        .single();
      if (e1) return new NextResponse(e1.message, { status: 500 });

      const segSlug = await uniqSlug(
        supabase,
        "segments",
        slugify(`${name}-placeholder`)
      );
      const { data: createdSeg, error: e2 } = await supabase
        .from("segments")
        .insert([
          {
            name: `${name} — مجمّع`,
            slug: segSlug,
            sort_order: 0,
            subcategory_id: firstSub.id,
          },
        ])
        .select("id")
        .single();
      if (e2) return new NextResponse(e2.message, { status: 500 });
      relinkToSegmentId = createdSeg.id;
    }
  }

  // 5) انقل المنتجات أولاً (مهم جداً لتفادي FK error) — قبل أي حذف
  if (force && prodCount > 0 && relinkToSegmentId) {
    const { error: updErr } = await supabase
      .from("products")
      .update({ segment_id: relinkToSegmentId })
      .in("segment_id", segIds);
    if (updErr) return new NextResponse(updErr.message, { status: 500 });
  }

  // 6) نقل/إعادة تشكيل الأطفال مع الحفاظ على 3 طبقات (بعد ما أمّنا المنتجات)
  if (withChildren && newContainerId) {
    if (from === "root" && to === "sub") {
      const { data: subsOld } = await supabase
        .from("subcategories")
        .select("id,name,sort_order")
        .eq("category_id", id)
        .order("sort_order", { ascending: true });

      if ((subsOld?.length ?? 0) === 1) {
        const s = subsOld![0];

        // seg يمثل sub القديم
        const segSlug = await uniqSlug(supabase, "segments", slugify(s.name));
        await supabase
          .from("segments")
          .insert([
            {
              name: s.name,
              slug: segSlug,
              sort_order: 0,
              subcategory_id: newContainerId,
            },
          ]);

        // انسخ Segs القديمة كأشقاء
        const { data: segsOld } = await supabase
          .from("segments")
          .select("id,name,sort_order")
          .eq("subcategory_id", s.id)
          .order("sort_order", { ascending: true });

        let cursor = 1;
        for (const g of segsOld ?? []) {
          const combinedName = `${s.name} — ${g.name}`;
          const gSlug = await uniqSlug(
            supabase,
            "segments",
            slugify(combinedName)
          );
          await supabase
            .from("segments")
            .insert([
              {
                name: combinedName,
                slug: gSlug,
                sort_order: cursor++,
                subcategory_id: newContainerId,
              },
            ]);
        }
      } else if ((subsOld?.length ?? 0) > 1) {
        // تركنا الأطفال كما هم (نقدر ننقلهم لاحقًا)، يكفي أننا أمّنا المنتجات
      }
    } else if (from === "sub" && to === "root") {
      const { data: kids } = await supabase
        .from("segments")
        .select("id,name,sort_order")
        .eq("subcategory_id", id)
        .order("sort_order", { ascending: true });

      for (const g of kids ?? []) {
        const sSlug = await uniqSlug(
          supabase,
          "subcategories",
          slugify(g.name)
        );
        await supabase
          .from("subcategories")
          .insert([
            {
              name: g.name,
              slug: sSlug,
              sort_order: g.sort_order,
              category_id: newContainerId,
            },
          ]);
      }
    } else if (from === "sub" && to === "seg") {
      // اجعل Segs الأطفال أشقاء تحت الأب الهدف
      const { data: kids } = await supabase
        .from("segments")
        .select("id")
        .eq("subcategory_id", id);
      for (const g of kids ?? []) {
        await supabase
          .from("segments")
          .update({ subcategory_id: targetParentId })
          .eq("id", g.id);
      }
    }
    // (seg->sub / seg->root) تم التعامل مع المنتجات والوجهة مسبقًا
  }

  // 7) احذف المصدر الآن (بعد ضمان نقل المنتجات)
  const srcTable =
    from === "root"
      ? "categories"
      : from === "sub"
      ? "subcategories"
      : "segments";
  const { error: delErr } = await supabase.from(srcTable).delete().eq("id", id);
  if (delErr) return new NextResponse(delErr.message, { status: 500 });

  return NextResponse.json({
    ok: true,
    newId: newContainerId,
    relinkedTo: relinkToSegmentId ?? null,
  });
}
