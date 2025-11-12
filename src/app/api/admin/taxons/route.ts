// src/app/api/admin/taxons/route.ts
import { NextResponse } from "next/server";
import { createClient as createSb } from "@supabase/supabase-js";

/**
 * نستخدم Service Role هنا فقط لتجاوز RLS لعمليات الإدارة.
 * لازم تكون المتغيرات التالية موجودة:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */
function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE service credentials in env.");
  }
  return createSb(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/* ========= Helpers ========= */
function ok(data: any, status = 200) {
  return new NextResponse(JSON.stringify({ success: true, data }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control":
        "public, max-age=15, s-maxage=60, stale-while-revalidate=60",
    },
  });
}
function fail(error: string, status = 400, meta?: any) {
  return NextResponse.json({ success: false, error, meta }, { status });
}

/** يبني شجرة من صفوف مسطّحة */
function buildTree(rows: any[]) {
  const byId = new Map<string, any>();
  const roots: any[] = [];
  rows.forEach((r) => byId.set(r.id, { ...r, children: [] }));
  rows.forEach((r) => {
    const node = byId.get(r.id);
    if (r.parent_id && byId.has(r.parent_id)) {
      byId.get(r.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRec = (n: any) => {
    if (n.children?.length) {
      n.children.sort(
        (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
      n.children.forEach(sortRec);
    }
  };
  roots.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  roots.forEach(sortRec);
  return roots;
}

/* ========= GET: taxons (flat/tree) =========
   - flat=true  : نُرجع فقط النشط (status='active' & is_active=true) كقائمة مسطّحة
   - flat=false : نُرجع الشجرة، ويمكن تمرير status=active|draft|archived|hidden|sale|out|all
*/
export async function GET(req: Request) {
  try {
    const supa = createServiceClient();
    const url = new URL(req.url);

    const flat = url.searchParams.get("flat") === "true";
    const statusParam = (url.searchParams.get("status") || "").toLowerCase();

    let q = supa
      .from("taxons")
      .select(
        "id,parent_id,level,name,slug,sort_order,status,is_active,created_at"
      )
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (flat) {
      // بطاقة الإدارة: اعرض النشط فقط
      q = q.eq("status", "active").eq("is_active", true);
    } else {
      // فلترة الشجرة بالـ status إن طُلب (غير 'all')
      if (statusParam && statusParam !== "all") q = q.eq("status", statusParam);
    }

    const { data, error } = await q;
    if (error) return fail(error.message, 500, { where: "select/taxons" });

    const rows = (data ?? []).filter((t: any) =>
      ["root", "sub", "seg"].includes(String(t.level))
    );

    if (flat) {
      // قائمة مسطّحة
      return ok(
        rows.map((r: any) => ({
          id: r.id,
          parent_id: r.parent_id,
          level: r.level as "root" | "sub" | "seg",
          name: r.name,
          slug: r.slug,
          sort_order: r.sort_order ?? 0,
        })),
        200
      );
    }

    // شجرة كاملة
    return ok(buildTree(rows), 200);
  } catch (e: any) {
    return fail(e?.message || "Service error", 500);
  }
}

/* ========= POST: إنشاء تصنيف ========= */
export async function POST(req: Request) {
  try {
    const supa = createServiceClient();

    const body = await req.json().catch(() => ({}));
    const level = body?.level as "root" | "sub" | "seg" | undefined;
    const parentId = (body?.parentId ?? null) as string | null;
    const name = (body?.name ?? "").toString().trim();

    if (!level || !name)
      return new NextResponse("invalid body", { status: 400 });

    // احسب sort_order = آخر عنصر في الحاوية
    let q = supa.from("taxons").select("id", { count: "exact", head: true });
    if (level === "root") q = q.is("parent_id", null);
    else q = q.eq("parent_id", parentId);

    const { count, error: eCount } = await q;
    if (eCount) return new NextResponse(eCount.message, { status: 500 });

    const sort_order = count ?? 0;

    const { error } = await supa.from("taxons").insert([
      {
        level,
        parent_id: level === "root" ? null : parentId,
        name,
        sort_order,
        status: "active",
        is_active: true,
      },
    ]);

    if (error) return new NextResponse(error.message, { status: 500 });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e: any) {
    return new NextResponse(e?.message || "Service error", { status: 500 });
  }
}
