// src/app/api/admin/taxons/route.ts
import { NextResponse } from "next/server";
import { createClient as createSb } from "@supabase/supabase-js";

/**
 * نستخدم Service Role هنا فقط لتجاوز RLS لعمليات الإدارة.
 * لازم تكون المتغيرات التالية موجودة في بيئة Vercel (Production):
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */
function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE service credentials in env.");
  }
  // عميل سيرفر بدون تخزين جلسة
  return createSb(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/* =========================
   GET: يعيد شجرة أو قائمة flat
   ========================= */
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

export async function GET(req: Request) {
  try {
    const supa = createServiceClient();
    const url = new URL(req.url);
    const flat = url.searchParams.get("flat") === "true";
    const status = url.searchParams.get("status") || "active"; // الافتراضي

    const { data, error } = await supa
      .from("taxons")
      .select("id,parent_id,level,name,slug,sort_order,status,is_active")
      .eq("status", status) // غيّرها إن بغيت تعرض الكل
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json(
        { status: 500, success: false, error: error.message },
        { status: 500 }
      );
    }

    if (flat) {
      return NextResponse.json({
        status: 200,
        success: true,
        data: (data ?? []).map((r) => ({
          id: r.id,
          parent_id: r.parent_id,
          level: r.level,
          name: r.name,
          slug: r.slug,
          sort_order: r.sort_order,
        })),
      });
    }

    const tree = buildTree(data ?? []);
    return NextResponse.json({ status: 200, success: true, data: tree });
  } catch (e: any) {
    return NextResponse.json(
      { status: 500, success: false, error: e?.message || "Service error" },
      { status: 500 }
    );
  }
}

/* =========================
   POST: إنشاء تصنيف (كما هو)
   ========================= */
export async function POST(req: Request) {
  try {
    const supa = createServiceClient();

    const body = await req.json();
    const level = body?.level as "root" | "sub" | "seg" | undefined;
    const parentId = (body?.parentId ?? null) as string | null;
    const name = (body?.name ?? "").toString().trim();

    if (!level || !name) {
      return new NextResponse("invalid body", { status: 400 });
    }

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
      },
    ]);

    if (error) return new NextResponse(error.message, { status: 500 });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return new NextResponse(
      e instanceof Error ? e.message : "Service error",
      { status: 500 }
    );
  }
}
