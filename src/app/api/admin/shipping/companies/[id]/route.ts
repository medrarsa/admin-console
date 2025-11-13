import { NextResponse } from "next/server";
import createServerSupabase from "@/lib/supabase/server";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const b = await req.json();
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("shipping_companies")
    .update({ name: b.name, is_active: b.active }) // <- شلنا support_cod
    .eq("id", params.id)
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ success: false, error }, { status: 400 });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const sb = await createServerSupabase();
  const { error } = await sb
    .from("shipping_companies")
    .delete()
    .eq("id", params.id);
  if (error)
    return NextResponse.json({ success: false, error }, { status: 400 });
  return NextResponse.json({ success: true });
}
