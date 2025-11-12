import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/** body: { level: "root"|"sub"|"seg", parentId: string|null, order: string[] } */
export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { level, order } = await req.json();

  if (!level || !Array.isArray(order)) {
    return new NextResponse("invalid body", { status: 400 });
  }

  const table =
    level === "root"
      ? "categories"
      : level === "sub"
      ? "subcategories"
      : "segments";

  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    const { error } = await supabase
      .from(table)
      .update({ sort_order: i })
      .eq("id", id);
    if (error) return new NextResponse(error.message, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
