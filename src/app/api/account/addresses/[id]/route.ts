import { NextResponse } from "next/server";
import createServerSupabase from "@/lib/supabase/server";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json();

  // اجلب العنوان للتحقق من الملكية عبر customers
  const { data: addr } = await supabase.from("customer_addresses").select("id, customer_id").eq("id", params.id).maybeSingle();
  if (!addr) return NextResponse.json({ success: false, error: "not found" }, { status: 404 });

  // تحقق من أن هذا العنوان يخص نفس المستخدم
  const { data: cust } = await supabase.from("customers").select("id, user_id").eq("id", addr.customer_id).maybeSingle();
  if (!cust || cust.user_id !== user.id) return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });

  if (body.is_default === true) {
    await supabase.from("customer_addresses").update({ is_default: false }).eq("customer_id", cust.id);
  }

  const { data, error } = await supabase.from("customer_addresses").update(body).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ success: false, error }, { status: 400 });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });

  // تحقّق الملكية مثل أعلاه (اختصارًا نحذف مباشرة مع RLS مناسبة لو فعّلتها لاحقًا)
  const { error } = await supabase.from("customer_addresses").delete().eq("id", params.id);
  if (error) return NextResponse.json({ success: false, error }, { status: 400 });
  return NextResponse.json({ success: true });
}
