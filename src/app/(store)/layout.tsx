import * as React from "react";
import StoreHeader from "@/app/(store-components)/header/StoreHeader";
import StoreFooter from "@/app/(store-components)/footer/StoreFooter";
import StickyCategoriesTabs from "@/app/(store-components)/header/StickyCategoriesTabs";

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <StoreHeader />
      <StickyCategoriesTabs /> {/* ← هذا هو الثابت أعلى الصفحة عند النزول */}
      <main className="min-h-[60vh]">{children}</main>
      <StoreFooter />
    </>
  );
}
