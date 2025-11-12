// src/app/api/store/cart/attach-user/route.ts  (POST)
import { NextResponse } from "next/server";
import { attachUserToCart } from "@/lib/store/cart";

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    const data = await attachUserToCart(userId);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("[cart/attach-user] error:", error?.message || error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 400 });
  }
}
