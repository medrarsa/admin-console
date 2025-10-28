import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/** body: { parentId: string|null, level: "root"|"sub"|"seg", order: string[] } */
export async function POST(req: Request) {
  const supa = await createServerSupabase();
  const { parentId: _parentId, level: _level, order } = await req.json();

  if (!Array.isArray(order))
    return new NextResponse("invalid body", { status: 400 });

  // تأكد أن كل الـids تخص نفس الحاوية (اختياري)
  for (let i = 0; i < order.length; i++) {
    const { error } = await supa
      .from("taxons")
      .update({ sort_order: i })
      .eq("id", order[i]);
    if (error) return new NextResponse(error.message, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
