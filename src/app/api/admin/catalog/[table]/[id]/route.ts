import { NextResponse, NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ table: string; id: string }> }
) {
  const supabase = await createServerSupabase();
  const { table, id } = await context.params;

  const { name } = await req.json();

  if (!name || !table || !id) {
    return new NextResponse("invalid body", { status: 400 });
  }
  if (!["categories", "subcategories", "segments"].includes(table)) {
    return new NextResponse("not found", { status: 404 });
  }

  const { error } = await supabase
    .from(table)
    .update({ name: String(name).trim() })
    .eq("id", id);

  if (error) {
    return new NextResponse(error.message, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
