let _taxonsOnce: Promise<any[]> | null = null;

export function fetchFlatTaxonsOnce(): Promise<any[]> {
  if (_taxonsOnce) return _taxonsOnce;
  _taxonsOnce = (async () => {
    const res = await fetch("/api/admin/taxons?flat=true", {
      cache: "no-store",
    });
    const j = await res.json();
    if (!res.ok || !j?.success)
      throw new Error(j?.error || "taxons fetch failed");
    return j.data as any[];
  })();
  return _taxonsOnce;
}
