// src/app/products/[slug]/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = (params?.slug ?? "").trim();
    if (!slug) {
      return NextResponse.json(
        { success: false, error: "SLUG_REQUIRED" },
        { status: 400 }
      );
    }

    // ✅ نبني URL داخلي لنفس السيرفر من _req.url
    const u = new URL(_req.url); // مثال: http://localhost:3000/products/some-slug
    u.pathname = "/api/store/products"; // نبدّل المسار إلى API المتجر
    u.search = `?slug=${encodeURIComponent(slug)}`; // نمرر الـ slug كاستعلام

    const r = await fetch(u.toString(), { cache: "no-store" });
    const j = await r.json().catch(() => ({}));

    if (!r.ok || !j?.success) {
      return NextResponse.json(
        {
          success: false,
          error: j?.error || `STORE_PRODUCTS_GET_${r.status}`,
          meta: { slug },
        },
        { status: r.status || 500 }
      );
    }

    // j.data سيكون المنتج المفرد (وفيه price_canonical)
    return NextResponse.json({ success: true, data: j.data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
