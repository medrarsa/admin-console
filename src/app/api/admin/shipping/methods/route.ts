import { NextResponse } from "next/server";
import createServerSupabase from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const carrierId = url.searchParams.get("carrier_id");
  const sb = await createServerSupabase();
  let q = sb
    .from("shipping_methods")
    .select("*")
    .order("created_at", { ascending: false });
  if (carrierId) q = q.eq("company_id", carrierId);
  const { data, error } = await q;
  if (error)
    return NextResponse.json({ success: false, error }, { status: 400 });
  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const b = await req.json();
  const sb = await createServerSupabase();
  const payload = {
    company_id: String(b.company_id),
    name: String(b.name ?? "طريقة جديدة"),
    is_active: true,
    allow_cod: !!b.allow_cod,
    lead_time_min_days: b.lead_min ?? 2,
    lead_time_max_days: b.lead_max ?? 5,
  };
  const { data, error } = await sb
    .from("shipping_methods")
    .insert(payload)
    .select("*")
    .single();
  if (error)
    return NextResponse.json({ success: false, error }, { status: 400 });
  return NextResponse.json({ success: true, data });
}
