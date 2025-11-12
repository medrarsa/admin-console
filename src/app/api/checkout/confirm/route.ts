import { NextResponse } from "next/server";
import createServerSupabase from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });

  const { address_id } = await req.json(); // اختياري الآن

  // اجلب customer
  const { data: cust, error: e0 } = await supabase
    .from("customers").select("id").eq("user_id", user.id).maybeSingle();
  if (e0 || !cust) return NextResponse.json({ success: false, error: "no customer" }, { status: 400 });

  // اجلب السلة المرتبطة بالمستخدم
  const { data: cart } = await supabase.from("carts").select("id").eq("user_id", user.id).maybeSingle();
  if (!cart) return NextResponse.json({ success: false, error: "empty cart" }, { status: 400 });

  const { data: items } = await supabase.from("cart_items").select("*").eq("cart_id", cart.id);
  if (!items || items.length === 0) return NextResponse.json({ success: false, error: "empty cart" }, { status: 400 });

  // TODO: تحقق المخزون النهائي هنا (اختصار الآن)
  // إنشاء الطلب
  const { data: order, error: e1 } = await supabase
    .from("orders")
    .insert({ customer_id: cust.id, status: "pending" })
    .select("id")
    .single();
  if (e1) return NextResponse.json({ success: false, error: e1 }, { status: 400 });

  // إنشاء بنود الطلب
  for (const it of items) {
    const price = it.unit_sale ?? it.unit_list;
    const { error: e2 } = await supabase
      .from("order_items")
      .insert({
        order_id: order.id,
        variant_id: it.variant_id,    // للمنتج بدون متغير ممكن نضع متغير رئيسي أو نسمح null لو جدولك يسمح
        quantity: it.qty,
        unit_price: price,
      });
    if (e2) return NextResponse.json({ success: false, error: e2 }, { status: 400 });
  }

  // تفريغ السلة
  await supabase.from("cart_items").delete().eq("cart_id", cart.id);

  return NextResponse.json({ success: true, data: { orderId: order.id } });
}
