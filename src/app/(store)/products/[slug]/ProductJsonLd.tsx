"use client";
import * as React from "react";
import Script from "next/script";

type Props = {
  name: string;
  image?: string | null;
  brand?: string | null;
  sku?: string | null;
  price: number | null;
  salePrice?: number | null;
  currency?: string;
  url?: string;
};

export default function ProductJsonLd({
  name, image, brand, sku, price, salePrice, currency = "SAR", url
}: Props) {
  const offerPrice = salePrice && price && salePrice < price ? salePrice : price;
  const data = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name,
    image: image ? [image] : [],
    brand: brand ? { "@type": "Brand", name: brand } : undefined,
    sku: sku ?? undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: currency,
      price: offerPrice ?? 0,
      availability: "https://schema.org/InStock",
      url,
    },
  };
  return <Script id="product-ld" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
