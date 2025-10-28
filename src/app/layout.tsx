import "./globals.css";
import { Tajawal } from "next/font/google";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "700", "800"],
  display: "swap",
});

export const metadata = { title: "لوحة الإدارة" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${tajawal.className} bg-gray-50 text-gray-900`}>
        {children}
      </body>
    </html>
  );
}
