import { NextResponse } from "next/server";
import createServerSupabase from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("branches")
    .select("id")
    .limit(1)
    .maybeSingle();
  return NextResponse.json({ id: data?.id || null });
}
