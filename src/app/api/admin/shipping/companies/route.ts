import { NextResponse } from "next/server";
import createServerSupabase from "@/lib/supabase/server";

export async function GET() {
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("shipping_companies")
    .select("*")
    .order("name");
  if (error)
    return NextResponse.json({ success: false, error }, { status: 400 });
  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const b = await req.json();
  const sb = await createServerSupabase();
  const { data, error } = await sb
    .from("shipping_companies")
    .insert({ name: b.name, is_active: !!b.active }) // <- شلنا support_cod
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ success: false, error }, { status: 400 });
  return NextResponse.json({ success: true, data });
}
