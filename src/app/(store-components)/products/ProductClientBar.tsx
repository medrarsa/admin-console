// src/app/(store-components)/products/ProductClientBar.tsx
"use client";
import * as React from "react";
import AddToCartBar from "./AddToCartBar";

export default function ProductClientBar({ productId }: { productId: string }) {
  return (
    <AddToCartBar
      onAdd={async (qty) => {
        await fetch("/api/store/cart", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productId, qty }),
        });
      }}
    />
  );
}
