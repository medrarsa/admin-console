// src/app/api/admin/tags/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import createServerSupabase, {
  createServiceRoleSupabase,
} from "@/lib/supabase/server";

/* ========= helpers ========= */
const ok = (data: any, status = 200) =>
  NextResponse.json(
    {
      success: true,
      status,
      data,
      total: Array.isArray(data) ? data.length : undefined,
    },
    { status }
  );
const fail = (error: string, status = 400, meta?: any) =>
  NextResponse.json({ success: false, status, error, meta }, { status });

/**
 * GET /api/admin/tags?q=cam&page=1&per=50
 * تُرجع شكل: { success, status, data: [{id,name}], total }
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const per = Math.min(
      200,
      Math.max(1, Number(searchParams.get("per") || 50))
    );
    const from = (page - 1) * per;
    const to = from + per - 1;

    let query = supabase
      .from("tags")
      .select("id,name", { count: "exact" })
      .order("name", { ascending: true });

    if (q) {
      // ilike للبحث الجزئي
      query = query.ilike("name", `%${q}%`);
    }

    const { data, error, count } = await query.range(from, to);
    if (error) return fail(error.message, 400, { where: "select/tags" });

    return NextResponse.json({
      success: true,
      status: 200,
      data: data ?? [],
      total: count ?? (data?.length || 0),
    });
  } catch (e: any) {
    return fail(e?.message || "تعذّر جلب الوسوم", 400);
  }
}

/**
 * POST /api/admin/tags
 * body: { name: string }
 * يُنشئ الوسم إن لم يوجد (حسب الاسم) ويرجع {id,name}
 */
export async function POST(req: NextRequest) {
  try {
    const admin = createServiceRoleSupabase();
    const body = await req.json().catch(() => ({}));
    const raw = (body?.name ?? "").toString().trim();

    if (!raw) return fail("الاسم مطلوب", 422);
    // نمنع أسماء فارغة/قصيرة جدًا
    if (raw.length < 1 || raw.length > 120)
      return fail("طول الاسم غير صالح", 422);

    // تحقق من الوجود (حساس لحالة الأحرف؟ نستخدم ilike لمطابقة غير حساسة)
    const { data: ex } = await admin
      .from("tags")
      .select("id,name")
      .ilike("name", raw)
      .maybeSingle();
    if (ex?.id) {
      return ok({ id: ex.id, name: ex.name }, 200);
    }

    const { data, error } = await admin
      .from("tags")
      .insert({ name: raw })
      .select("id,name")
      .single();
    if (error) return fail(error.message, 400, { where: "insert/tags" });

    return ok({ id: data!.id, name: data!.name }, 201);
  } catch (e: any) {
    return fail(e?.message || "تعذّر إنشاء الوسم", 400);
  }
}
