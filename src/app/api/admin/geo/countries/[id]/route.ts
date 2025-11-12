import { NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supa = createServiceRoleSupabase(); // bypass RLS
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({} as any));
  const payload: any = {};
  if (typeof body.name === "string") payload.name = body.name.trim();
  if (typeof body.code === "string") payload.code = body.code.trim();
  if (body.code === null) payload.code = null;
  if (typeof body.is_active === "boolean") payload.is_active = body.is_active;

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ success: false, error: "empty_payload" }, { status: 422 });
  }

  const { data, error } = await supa
    .from("countries")
    .update(payload)
    .eq("id", id)
    .select("id,name,code,is_active")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, data });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supa = createServiceRoleSupabase(); // bypass RLS
  const { id } = await ctx.params;

  const { error } = await supa.from("countries").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
