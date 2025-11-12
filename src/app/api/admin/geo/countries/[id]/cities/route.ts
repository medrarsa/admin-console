// src/app/api/admin/geo/countries/[id]/cities/route.ts
import { NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supa = createServiceRoleSupabase(); // bypass RLS
  const { id: countryId } = await ctx.params;

  const body = await req.json().catch(() => ({} as any));
  const name = String(body?.name || "").trim();

  if (!countryId) {
    return NextResponse.json({ success: false, error: "missing_country" }, { status: 422 });
  }
  if (!name) {
    return NextResponse.json({ success: false, error: "invalid_name" }, { status: 422 });
  }

  const { data, error } = await supa
    .from("cities")
    .insert({ country_id: countryId, name })
    .select("id,name,is_active")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, data });
}
