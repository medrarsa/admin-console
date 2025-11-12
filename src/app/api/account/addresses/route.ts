import { NextResponse } from "next/server";
import createServerSupabase from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: true, data: [] });

  const { data: cust } = await supabase
    .from("customers").select("id").eq("user_id", user.id).maybeSingle();
  if (!cust) return NextResponse.json({ success: true, data: [] });

  const { data, error } = await supabase
    .from("customer_addresses")
    .select("*")
    .eq("customer_id", cust.id)
    .order("is_default", { ascending: false });
  if (error) return NextResponse.json({ success: false, error }, { status: 400 });
  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });

  const { data: cust } = await supabase
    .from("customers").select("id").eq("user_id", user.id).maybeSingle();
  if (!cust) return NextResponse.json({ success: false, error: "no customer" }, { status: 400 });

  const body = await req.json();
  const row = { ...body, customer_id: cust.id };

  // إذا is_default=true، عطّل غيره
  if (row.is_default === true) {
    await supabase
      .from("customer_addresses")
      .update({ is_default: false })
      .eq("customer_id", cust.id);
  }

  const { data, error } = await supabase
    .from("customer_addresses")
    .insert(row)
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error }, { status: 400 });
  return NextResponse.json({ success: true, data });
}
