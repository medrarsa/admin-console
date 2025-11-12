// src/app/admin/page.tsx (كما أرسلت)
import MainContent from "./_components/MainContent";

export default function AdminHome() {
  return (
    <MainContent>
      <h1 className="text-xl font-extrabold mb-3">الرئيسية</h1>
      <p className="text-sm text-gray-600">هذا المحتوى داخل MainContent فقط.</p>
    </MainContent>
  );
}
