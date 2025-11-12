// src/app/admin/products/types.ts

export type Product = {
  id: string;
  name: string;
  status: "active" | "draft" | "archived" | "hidden" | "sale" | "out";
  pinned?: boolean;
  imageUrl?: string;

  // قد تكون undefined إذا الحقل مقفول في البطاقة
  price?: number;
  salePrice?: number;
  qty?: number;

  // حقول التسعير/الكمية القادمة من API
  variants_price_min: number | null;
  variants_price_max: number | null;
  variants_price_label: string | null;
  variants_total_qty: number;
  base_price_fallback: number | null;
  base_qty_fallback: number;

  tags?: string[];
  localCategory?: string | null;

  costPrice?: number;
  discountEnd?: string;
  sku?: string;
  brand?: string | null;
  shortTitle?: string;
  years?: string;
  descriptionHtml?: string;
  seoTitleTpl?: string;
  seoSlugTpl?: string;
  seoDescTpl?: string;

  optionsEnabled?: boolean;
  options?: OptionGroup[];
  variants?: VariantRow[];

  _isNew?: boolean;
};

export type OptionGroupType = "text" | "color" | "image";
export type OptionValue = {
  id: string;
  label: string;
  colorHex?: string;
  imageUrl?: string;
};
export type OptionGroup = {
  id: string;
  type: OptionGroupType;
  name: string;
  values: OptionValue[];
};
export type VariantRow = {
  id: string;
  optionValueIds: string[];
  sku?: string;
  qty?: number;
};
