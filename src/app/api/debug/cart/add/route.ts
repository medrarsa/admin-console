// src/app/api/debug/cart/add/route.ts
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import createServerSupabase from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createServerSupabase();
  const ck = await cookies();
  const hs = await headers();
  const sid = ck.get("sid")?.value || hs.get("x-session-id") || "debug_sid";
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;

  const { data, error } = await supabase.rpc("ensure_cart_and_add_item", {
    p_session_id: userId ? null : sid,
    p_user_id: userId,
    p_product_id: "<حط UUID منتج>",
    p_variant_id: "<حط UUID متغير>",
    p_qty: 1,
    p_unit_list: 100,
    p_unit_sale: null,
    p_label_kind: null,
    p_label_text: null,
    p_snapshot: {},
  });

  return NextResponse.json({ data, error });
}
