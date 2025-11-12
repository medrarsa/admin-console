// src/app/api/store/cart/route.ts
import { NextResponse } from "next/server";
import { getCart } from "@/lib/store/cart";

export async function GET() {
  try {
    const data = await getCart(null);
    const items = Array.isArray((data as any)?.items) ? (data as any).items : [];
    const count = items.reduce((s: number, it: any) => s + (Number(it?.qty) || 0), 0);

    return NextResponse.json({ success: true, data: { ...data, count } });
  } catch (error: any) {
    console.error("[cart] error:", error?.message || error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 400 });
  }
}
