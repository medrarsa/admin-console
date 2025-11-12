// src/app/api/store/cart/add/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { addToCart } from "@/lib/store/cart";

type PriceCanonical = {
  list: number;
  sale: number | null;
  label?: { kind: "sale" | "single" | "range"; text: string };
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // ---- التحقق من المدخلات ----
    const productId = body?.productId ? String(body.productId) : null;
    if (!productId) {
      return NextResponse.json({ success: false, error: "productId is required" }, { status: 400 });
    }

    const qtyRaw = body?.qty ?? 1;
    const qty = Number(qtyRaw);
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ success: false, error: "qty must be a positive number" }, { status: 400 });
    }

    const price: PriceCanonical | undefined = body?.priceCanonical;
    const listOk = typeof price?.list === "number" && Number.isFinite(price.list);
    const saleOk = price?.sale === null || typeof price?.sale === "number";
    if (!price || !listOk || !saleOk) {
      return NextResponse.json(
        { success: false, error: "priceCanonical { list:number, sale:number|null } is required" },
        { status: 400 }
      );
    }

    // ---- تثبيت/ضمان sid في الكوكي قبل أي مناداة تعتمد RLS/GUC ----
    const jar = await cookies(); // ← لازم await في Next 15
    if (!jar.get("sid")) {
      jar.set("sid", randomUUID(), {
        httpOnly: false,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365, // سنة
      });
    }

    // ---- تنفيذ الإضافة عبر طبقة الخدمة (تستدعي RPC داخلياً) ----
    const item = await addToCart({
      cartId: body.cartId ?? null,
      productId,
      variantId: body?.variantId ? String(body.variantId) : null,
      qty,
      price,
      snapshot: body?.snapshot ?? {},
    });

    return NextResponse.json({ success: true, data: item });
  } catch (error: any) {
    const msg = error?.message || error?.hint || error?.details || String(error);
    console.error("[cart/add] error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
