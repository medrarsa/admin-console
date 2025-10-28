import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/\-+/g, "-");
}

async function ensureUniqueSlug(
  supabase: any,
  table: "categories",
  base: string
): Promise<string> {
  let slug = base || "item";
  let suffix = 0;
  // نفحص التكرار
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("id")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) break;
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
  return slug;
}

// POST /api/admin/catalog/categories
export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const body = await req.json().catch(() => ({}));
  const name: string | undefined = body?.name;
  let slug: string | undefined = body?.slug;

  if (!name || !name.trim()) {
    return new NextResponse("name is required", { status: 400 });
  }

  // توليد slug إن لم يُرسل
  const base = slugify(slug || name);
  slug = await ensureUniqueSlug(supabase, "categories", base);

  const { data, error } = await supabase
    .from("categories")
    .insert([{ name: name.trim(), slug }])
    .select("id,name,slug,sort_order,is_active,created_at")
    .single();

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
