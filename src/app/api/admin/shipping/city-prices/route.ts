import { NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET /api/admin/shipping/city-prices?method_id=..&country_id=..(اختياري) */
export async function GET(req: Request) {
  const supa = createServiceRoleSupabase();
  const url = new URL(req.url);
  const methodId = url.searchParams.get("method_id");
  const countryId = url.searchParams.get("country_id");

  if (!methodId) {
    return NextResponse.json(
      { success: false, error: "missing_method_id" },
      { status: 400 }
    );
  }

  if (countryId) {
    const { data, error } = await supa
      .from("method_city_prices")
      .select("city_id, base_fee, cities!inner(country_id)")
      .eq("method_id", methodId)
      .eq("cities.country_id", countryId);

    if (error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );

    const shaped = (data ?? []).map((r: any) => ({
      city_id: r.city_id,
      base_fee: Number(r.base_fee) || 0,
    }));
    return NextResponse.json({ success: true, data: shaped });
  }

  const { data, error } = await supa
    .from("method_city_prices")
    .select("city_id, base_fee")
    .eq("method_id", methodId);

  if (error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ success: true, data: data ?? [] });
}

/** POST /api/admin/shipping/city-prices
 *  body: { method_id: string, items: [{ city_id, base_fee }] }
 *  يعمل upsert على (method_id, city_id)
 */
export async function POST(req: Request) {
  const supa = createServiceRoleSupabase();
  const body = await req.json().catch(() => ({}));
  const method_id = String(body?.method_id || "");
  const items = Array.isArray(body?.items) ? body.items : [];

  if (!method_id || items.length === 0) {
    return NextResponse.json(
      { success: false, error: "invalid_payload" },
      { status: 400 }
    );
  }

  const rows = items.map((x: any) => ({
    method_id,
    city_id: String(x.city_id),
    base_fee: Number(x.base_fee) || 0,
    vat_included: true,
  }));

  const { data, error } = await supa
    .from("method_city_prices")
    .upsert(rows, { onConflict: "method_id,city_id" })
    .select("method_id, city_id, base_fee");

  if (error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ success: true, data });
}

/** DELETE /api/admin/shipping/city-prices
 *  body: { method_id: string, city_ids: string[] }
 *  يحذف الأسعار (يلغي الربط) لهذه المدن
 */
export async function DELETE(req: Request) {
  const supa = createServiceRoleSupabase();
  const body = await req.json().catch(() => ({}));
  const method_id = String(body?.method_id || "");
  const city_ids: string[] = Array.isArray(body?.city_ids)
    ? body.city_ids.map(String)
    : [];

  if (!method_id || city_ids.length === 0) {
    return NextResponse.json(
      { success: false, error: "invalid_delete_payload" },
      { status: 400 }
    );
  }

  const { error } = await supa
    .from("method_city_prices")
    .delete()
    .eq("method_id", method_id)
    .in("city_id", city_ids);

  if (error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ success: true });
}
