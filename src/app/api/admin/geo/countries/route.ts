// src/app/api/admin/geo/countries/route.ts
import { NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supa = createServiceRoleSupabase();

  const { data, error } = await supa
    .from("countries")
    .select("id,name,code,is_active,cities:cities(id,name,is_active)")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }

  const shaped = (data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    is_active: !!c.is_active,
    cities: Array.isArray(c.cities)
      ? c.cities.map((x: any) => ({ id: x.id, name: x.name, is_active: !!x.is_active }))
      : [],
  }));

  return NextResponse.json({ success: true, data: shaped });
}

export async function POST(req: Request) {
  const supa = createServiceRoleSupabase();
  const body = await req.json().catch(() => ({} as any));
  const name = String(body?.name || "").trim();
  const code = body?.code === null ? null : body?.code ? String(body.code).trim() : null;

  if (!name) {
    return NextResponse.json({ success: false, error: "invalid_name" }, { status: 422 });
  }

  const { data, error } = await supa
    .from("countries")
    .insert({ name, code })
    .select("id,name,code,is_active")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, data });
}
