// src/app/layout.tsx
import "./globals.css";
import * as React from "react";

export const metadata = { title: "متجرك", description: "متجر المنتجات" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-dvh bg-white text-zinc-900 antialiased">
        {children}
      </body>
    </html>
  );
}
