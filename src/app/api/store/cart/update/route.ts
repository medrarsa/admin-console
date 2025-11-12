// src/app/api/store/cart/update/route.ts  (POST)
import { NextResponse } from "next/server";
import { updateItemQty } from "@/lib/store/cart";

export async function POST(req: Request) {
  try {
    const { cartItemId, qty } = await req.json();
    if (!cartItemId) return NextResponse.json({ success: false, error: "cartItemId is required" }, { status: 400 });
    const data = await updateItemQty(cartItemId, qty);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("[cart/update] error:", error?.message || error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 400 });
  }
}
