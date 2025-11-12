// src/lib/price.ts

/** السعر الموحّد القادم من الـ API (مصدر الحقيقة) */
export type CanonicalPrice = {
  /** سعر القائمة قبل الخصم */
  list: number;
  /** سعر التخفيض إن وجد (null إذا لا يوجد) */
  sale: number | null;
  /** تسمية جاهزة للعرض (خصم / قيمة مفردة / نطاق يبدأ من ..) */
  label: { kind: "sale" | "single" | "range"; text: string };
};

/* ------------------------- أدوات مساعدة صغيرة ------------------------- */
const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** تحويل أي مدخل إلى رقم صالح أو null */
export const toNumber = (v: unknown): number | null => {
  if (isNum(v)) return v;
  if (typeof v === "string") {
    const s = v.replace(/[^\d.\-]/g, "").trim();
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** أرقام إنجليزية موحّدة */
export const money = (v?: number, fraction: 0 | 2 = 2) =>
  isNum(v)
    ? new Intl.NumberFormat("en-US", {
        minimumFractionDigits: fraction,
        maximumFractionDigits: fraction,
        useGrouping: true,
      }).format(v)
    : "";

/** تنسيق عملة ثابت: ر.س <المبلغ> */
/** تنسيق عملة ثابت: <المبلغ> ر.س */
export const moneySAR = (v?: number, fraction: 0 | 2 = 2) =>
  isNum(v) ? `${money(v, fraction)} ر.س` : "";

/* --------------------------- تهيئة السعر للعرض --------------------------- */
/**
 * يحوّل CanonicalPrice إلى حقول عرض جاهزة:
 * - primary: السعر المعروض (sale إن وجد وإلا list)
 * - secondary: السعر المشطوب (list إذا فيه خصم)
 * - badge: شارة %خصم أو نص “يبدأ من …” للنطاق
 */
export function formatPrice(p?: CanonicalPrice) {
  if (!p) {
    return {
      primary: "",
      secondary: null as string | null,
      badge: null as string | null,
    };
  }

  const list = toNumber(p.list) ?? 0;
  const sale = p.sale != null ? toNumber(p.sale) : null;

  // حالة الخصم الفعلي
  if (sale != null && sale < list) {
    const prc = Math.round(((list - sale) / list) * 100);
    return {
      primary: moneySAR(sale),
      secondary: moneySAR(list),
      badge: `${prc}% خصم`,
    };
  }

  // حالة عادية/نطاق
  return {
    primary: moneySAR(list),
    secondary: null,
    badge: p.label?.kind === "range" ? p.label.text : null,
  };
}

/* ----------------------------- مُخرجات إضافية ----------------------------- */
/** إرجاع نص موجز للسعر لاستخدامه في العناوين/الكروت */
export const summarizePrice = (p?: CanonicalPrice) => {
  if (!p) return "";
  if (p.sale != null && p.sale < p.list) return moneySAR(p.sale);
  if (p.label?.kind === "range") return p.label.text; // مثال: "يبدأ من ر.س 45"
  return moneySAR(p.list);
};
