import { NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supa = createServiceRoleSupabase();
  const url = new URL(req.url);
  const countryId =
    url.searchParams.get("country_id") ||
    url.searchParams.get("countryId") ||
    url.searchParams.get("country") ||
    "";
  const q = (url.searchParams.get("q") || "").trim();

  if (!countryId)
    return NextResponse.json(
      { success: false, error: "missing_country_id" },
      { status: 400 }
    );

  let query = supa
    .from("cities")
    .select("id,name,is_active")
    .eq("country_id", countryId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (q) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query;
  if (error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({
    success: true,
    data: (data ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      is_active: !!c.is_active,
    })),
  });
}
