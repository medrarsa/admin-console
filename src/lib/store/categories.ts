// src/lib/store/categories.ts
export type SegNode = { id: string; name: string; slug: string; sort?: number };
export type SubNode = {
  id: string;
  name: string;
  slug: string;
  sort?: number;
  segs: SegNode[];
};
export type RootNode = {
  id: string;
  name: string;
  slug: string;
  sort?: number;
  subs: SubNode[];
};

export async function fetchCategoriesTree(): Promise<RootNode[]> {
  const res = await fetch("/api/store/categories", { cache: "no-store" });
  const json = await res.json();
  if (!json?.success)
    throw new Error(json?.error || "failed to load categories");
  return json.data as RootNode[];
}
