import { NextResponse, NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const { id } = await context.params;

  const { name } = await req.json();
  if (!name || !String(name).trim()) {
    return new NextResponse("name required", { status: 400 });
  }

  const { error } = await supabase
    .from("categories")
    .update({ name: String(name).trim() })
    .eq("id", id);

  if (error) {
    return new NextResponse(error.message, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
