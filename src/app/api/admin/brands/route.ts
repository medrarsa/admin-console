// src/app/api/admin/brands/route.ts
import { NextRequest, NextResponse } from "next/server";
import createClient, { createServiceRoleSupabase } from "@/lib/supabase/server";
import { z } from "zod";

/* سماح أثناء التطوير لتسهيل الاختبار (نستعمله فقط للكتابة) */
function assertAdmin(req: NextRequest) {
  const role = req.headers.get("x-app-role") ?? "";
  if (process.env.NODE_ENV !== "production") {
    if (role === "admin" || role === "") return null;
  }
  if (role !== "admin") {
    return NextResponse.json(
      { message: "Forbidden (missing x-app-role=admin)" },
      { status: 403 }
    );
  }
  return null;
}

/* يسمح بـ URL خارجي أو مسار يبدأ بـ / (مثل /image/catalog/...) */
const UrlOrPath = z
  .string()
  .refine(
    (v) =>
      v === undefined ||
      v === null ||
      v === "" ||
      v.startsWith("http") ||
      v.startsWith("/"),
    "Invalid URL"
  );

/* لو slug فاضي نتجاهل كامل كائن الـSEO */
const SeoSchema = z.object({
  slug: z.string().min(1),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
  is_active: z.boolean().optional(),
});

const CreateBrandSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().optional(),
  ar_char: z.string().optional(),
  en_char: z.string().optional(),
  logo: UrlOrPath.optional(),
  banner: UrlOrPath.optional(),
  is_active: z.boolean().optional(),
  seo: z.preprocess((v) => {
    const o = v as any;
    if (!o || !o.slug || String(o.slug).trim() === "") return undefined;
    return o;
  }, SeoSchema).optional(),
});

/* =========================================
   GET  — قراءة الماركات (بدون الاعتماد على x-app-role)
   ========================================= */
export async function GET(req: NextRequest) {
  // نستخدم Service-Role للقراءة لضمان عدم سقوط الهيدر
  const supabase = createServiceRoleSupabase();

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const byChar = (searchParams.get("char") ?? "").trim();
  const active = searchParams.get("active");
  const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10), 1);
  const per = Math.min(Math.max(parseInt(searchParams.get("per") ?? "24", 10), 1), 100);
  const from = (page - 1) * per;
  const to = from + per - 1;

  let query = supabase.from("brands").select("*", { count: "exact" });
  if (q) query = query.ilike("name", `%${q}%`);
  if (byChar) query = query.or(`ar_char.eq.${byChar},en_char.ilike.${byChar}`);
  if (active === "true") query = query.eq("is_active", true);
  if (active === "false") query = query.eq("is_active", false);
  query = query.order("name", { ascending: true }).range(from, to);

  const { data: brands, error, count } = await query;
  if (error) {
    return NextResponse.json({ message: "DB error (brands)", error }, { status: 500 });
  }

  // SEO المرتبط
  let seoByBrandId: Record<string, any> = {};
  if (brands?.length) {
    const ids = brands.map((b) => b.id);
    const { data: seos } = await supabase
      .from("seo_pages")
      .select("id, entity_id, slug, meta_title, meta_description, is_active")
      .eq("entity_type", "brand")
      .eq("lang", "ar")
      .in("entity_id", ids);
    seoByBrandId = Object.fromEntries((seos ?? []).map((s: any) => [s.entity_id, s]));
  }

  const data = (brands ?? []).map((b: any) => ({ ...b, seo: seoByBrandId[b.id] ?? null }));
  return NextResponse.json({ data, page, per, total: count ?? data.length });
}

/* =========================================
   POST — إنشاء/تحديث ماركة (يتطلب admin ويكتب بـ Service-Role)
   ========================================= */
export async function POST(req: NextRequest) {
  // نحافظ على التحقق للكتابة فقط
  const guard = assertAdmin(req);
  if (guard) return guard;

  const supabase = await createClient();               // للقراءات الجانبية لو احتجنا
  const admin = createServiceRoleSupabase();           // للكتابة (RLS)

  const body = await req.json();
  const parsed = CreateBrandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: parsed.error.flatten() },
      { status: 422 }
    );
    }
  const payload = parsed.data;

  // إنشاء/تحديث الماركة بالاسم (onConflict=name)
  const { data: brand, error: insErr } = await admin
    .from("brands")
    .upsert(
      {
        name: payload.name,
        description: payload.description ?? null,
        ar_char: payload.ar_char ?? null,
        en_char: payload.en_char ?? null,
        logo: payload.logo ?? null,
        banner: payload.banner ?? null,
        is_active: payload.is_active ?? true,
      },
      { onConflict: "name" }
    )
    .select("*")
    .single();

  if (insErr || !brand) {
    return NextResponse.json({ message: "Failed to create brand", error: insErr }, { status: 500 });
  }

  // صفحة SEO (اختياري)
  if (payload.seo?.slug) {
    const seoRow = {
      entity_type: "brand",
      entity_id: brand.id,
      lang: "ar",
      slug: payload.seo.slug,
      meta_title: payload.seo.meta_title ?? null,
      meta_description: payload.seo.meta_description ?? null,
      is_active: payload.seo.is_active ?? true,
    };
    const { error: seoErr } = await admin
      .from("seo_pages")
      .upsert(seoRow, { onConflict: "entity_type,entity_id,lang" });
    if (seoErr) {
      return NextResponse.json(
        { message: "Brand created but SEO failed", data: brand, seo_error: seoErr },
        { status: 207 }
      );
    }
  }

  return NextResponse.json({ data: brand }, { status: 201 });
}
