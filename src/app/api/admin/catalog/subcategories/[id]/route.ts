import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase();
  const { name } = await req.json();
  if (!name || !String(name).trim())
    return new NextResponse("name required", { status: 400 });

  const { error } = await supabase
    .from("subcategories")
    .update({ name: String(name).trim() })
    .eq("id", params.id);
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
