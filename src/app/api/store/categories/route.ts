// src/app/api/store/categories/route.ts
import { NextResponse } from "next/server";
import createServerSupabase from "@/lib/supabase/server";

type SegNode = { id: string; name: string; slug: string; sort?: number };
type SubNode = {
  id: string;
  name: string;
  slug: string;
  sort?: number;
  segs: SegNode[];
};
type RootNode = {
  id: string;
  name: string;
  slug: string;
  sort?: number;
  subs: SubNode[];
};

export async function GET() {
  const supabase = await createServerSupabase();

  // نجيب كل المستويات لكن مع فلترة صارمة
  const { data, error } = await supabase
    .from("taxons")
    .select(
      "id,parent_id,level,name,slug,sort_order,is_active,status,archived_at,hide_products"
    )
    .in("level", ["root", "sub", "seg"])
    .eq("is_active", true)
    .eq("status", "active")
    .is("archived_at", null) // لا تُظهر المؤرشَف
    .or("hide_products.is.false,hide_products.is.null") // لو الحقل موجود؛ اعتبر null = false
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as {
    id: string;
    parent_id: string | null;
    level: "root" | "sub" | "seg";
    name: string;
    slug: string;
    sort_order: number | null;
    is_active: boolean;
    status: "active" | "hidden";
    archived_at: string | null;
    hide_products?: boolean | null;
  }[];

  const rootsMap = new Map<string, RootNode>();
  const subsMap = new Map<string, SubNode>();

  // جذور
  for (const r of rows) {
    if (r.level === "root") {
      rootsMap.set(r.id, {
        id: r.id,
        name: r.name,
        slug: r.slug,
        sort: r.sort_order ?? 0,
        subs: [],
      });
    }
  }
  // فروع
  for (const r of rows) {
    if (r.level === "sub" && r.parent_id && rootsMap.has(r.parent_id)) {
      const sub: SubNode = {
        id: r.id,
        name: r.name,
        slug: r.slug,
        sort: r.sort_order ?? 0,
        segs: [],
      };
      subsMap.set(r.id, sub);
      rootsMap.get(r.parent_id)!.subs.push(sub);
    }
  }
  // تقسيمات
  for (const r of rows) {
    if (r.level === "seg" && r.parent_id && subsMap.has(r.parent_id)) {
      subsMap.get(r.parent_id)!.segs.push({
        id: r.id,
        name: r.name,
        slug: r.slug,
        sort: r.sort_order ?? 0,
      });
    }
  }

  // ترتيب داخلي ثابت
  const roots = Array.from(rootsMap.values()).sort(
    (a, b) => (a.sort ?? 0) - (b.sort ?? 0)
  );
  for (const root of roots) {
    root.subs.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    for (const sub of root.subs)
      sub.segs.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  }

  return NextResponse.json({ success: true, data: roots }, { status: 200 });
}
