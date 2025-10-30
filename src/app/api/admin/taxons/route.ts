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
