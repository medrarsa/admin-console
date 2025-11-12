import { NextResponse } from "next/server";
import createServerSupabase from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: true, data: null });

  // customers.user_id = auth.users.id
  const { data: c } = await supabase
    .from("customers")
    .select("id, full_name, phone, email, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ success: true, data: c });
}
