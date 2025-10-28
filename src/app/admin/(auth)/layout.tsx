export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div dir="rtl">{children}</div>; // لا Navbar/Sidebar ولا حارس
}
