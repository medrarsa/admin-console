// src/app/api/store/cart/remove/route.ts  (POST)
import { NextResponse } from "next/server";
import { removeItem } from "@/lib/store/cart";

export async function POST(req: Request) {
  try {
    const { cartItemId } = await req.json();
    if (!cartItemId) return NextResponse.json({ success: false, error: "cartItemId is required" }, { status: 400 });
    const data = await removeItem(cartItemId);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("[cart/remove] error:", error?.message || error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 400 });
  }
}
