export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")   // حذف الرموز
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function ensureUniqueProductSlug(
  supabase: any,
  baseSlug: string
): Promise<string> {
  let slug = baseSlug;
  let i = 1;
  while (true) {
    const { data, error } = await supabase
      .from("seo_pages")
      .select("id")
      .eq("entity_type", "product")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) return slug;
    i += 1;
    slug = `${baseSlug}-${i}`;
  }
}
