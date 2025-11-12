// src/lib/num.ts
export function toEnDigits(input: string | number | null | undefined): string {
  if (input == null) return "";
  const s = String(input);
  const map: Record<string, string> = {
    "٠":"0","١":"1","٢":"2","٣":"3","٤":"4",
    "٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
    "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4",
    "۵":"5","۶":"6","۷":"7","۸":"8","۹":"9"
  };
  return s.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, d => map[d] ?? d);
}

export function formatCurrency(value: number | null | undefined, opts: {
  currency?: string; minimumFractionDigits?: number; arDigits?: boolean;
} = {}) {
  if (value == null || Number.isNaN(value)) return "";
  const { currency = "SAR", minimumFractionDigits = 0, arDigits = false } = opts;
  const s = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits,
    maximumFractionDigits: minimumFractionDigits,
  }).format(value);
  const numeric = s.replace(/[^\d.,\-]/g, "");
  const out = `${numeric} ر.س`;
  return arDigits ? toArDigits(out) : out;
}

export function toArDigits(input: string | number | null | undefined): string {
  if (input == null) return "";
  const s = String(input);
  const map = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"];
  return s.replace(/[0-9]/g, d => map[Number(d)] ?? d);
}
