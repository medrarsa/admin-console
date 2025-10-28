// src/app/admin/products/[id]/page.tsx  (بدون "use client")
import createServerSupabase from "@/lib/supabase/server";
import TabsShell from "./_components/TabsShell";

export default async function ProductDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createServerSupabase();
  const { data: product } = await supabase
    .from("products")
    .select("id, name, status")
    .eq("id", params.id)
    .maybeSingle();

  if (!product) {
    return (
      <div className="content">
        <h2 className="text-xl font-bold">المنتج غير موجود</h2>
      </div>
    );
  }

  return (
    <div className="content space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">{product.name}</h1>
          <p className="text-sm text-gray-500">ID: {product.id}</p>
        </div>
      </div>
      <TabsShell productId={product.id} />
    </div>
  );
}
