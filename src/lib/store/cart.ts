// src/lib/store/cart.ts
import { cookies, headers } from "next/headers";
import createServerSupabase from "@/lib/supabase/server";

/* ----------------------------- Types & helpers ----------------------------- */
export type PriceCanonical = {
  list: number;
  sale: number | null;
  label?: { kind: "sale" | "single" | "range"; text: string };
};

export function ensurePositiveInt(n: any, fallback = 1) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

function snapshotKey(productId: string, variantId?: string | null, snapshot?: any) {
  return `${productId}|${variantId ?? ""}|${JSON.stringify(snapshot ?? {})}`;
}

/* ------------------------------- Session/RLS ------------------------------- */
async function setSessionGUC(supabase: any, sid: string) {
  await supabase.rpc("set_request_session_id", { val: sid });
}

async function resolveSessionId(): Promise<string> {
  const ck = await cookies();
  const hs = await headers();
  return ck.get("sid")?.value || hs.get("x-session-id") || crypto.randomUUID();
}

/* --------------------------------- Actions -------------------------------- */
export async function initCart({ sessionId }: { sessionId?: string | null }) {
  const supabase = await createServerSupabase();
  const sid = sessionId || (await resolveSessionId());
  await setSessionGUC(supabase, sid);

  const { data: existing, error: e1 } = await supabase
    .from("carts")
    .select("id, session_id, user_id")
    .eq("session_id", sid)
    .maybeSingle();
  if (e1) throw e1;

  if (existing) {
    return { cartId: existing.id, sessionId: sid };
  }

  const { data: inserted, error: e2 } = await supabase
    .from("carts")
    .insert({ session_id: sid })
    .select("id")
    .single();
  if (e2) throw e2;

  return { cartId: inserted.id, sessionId: sid };
}

 // src/lib/store/cart.ts  (استبدل getCart فقط)
export async function getCart(cartId?: string | null) {
  const supabase = await createServerSupabase();

  // نحدّد السياق
  const ck = await cookies();
  const hs = await headers();
  const sid = ck.get("sid")?.value || hs.get("x-session-id") || null;

  // لو عندك جلسة مستخدم
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;

  // قراءة السلة عبر RPC واحدة (لا نعتمد على set_config الآن)
  const { data, error } = await supabase.rpc("get_cart_for_session", {
    p_user_id: userId,
    p_session_id: userId ? null : sid,
  });

  if (error) throw error;

  const j = (data as any) || {};
  const items = Array.isArray(j.items) ? j.items : [];
  const totals = j.totals || { subtotal: 0, discount: 0, grand: 0 };

  // لو مرّرت cartId وكان مختلف، صفّره (حالة edge نادرة)
  if (cartId && j.cart_id && cartId !== j.cart_id) {
    // نرجّع السلة المرئية فعليًا
  }

  return { cart_id: j.cart_id ?? null, items, totals };
}

export async function addToCart(input: {
  cartId?: string | null;
  productId: string;
  variantId?: string | null;
  qty: number;
  price: PriceCanonical;
  snapshot: any;
}) {
  const { productId, variantId = null, qty, price, snapshot } = input;

  const supabase = await createServerSupabase();

  const sid = await resolveSessionId();
  await setSessionGUC(supabase, sid);

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;

  const unit_list = Number(price.list ?? 0);
  const unit_sale = price.sale != null ? Number(price.sale) : null;
  const label_kind = price.label?.kind ?? null;
  const label_text = price.label?.text ?? null;

  const { data, error } = await supabase.rpc("ensure_cart_and_add_item", {
    p_user_id: userId,
    p_session_id: userId ? null : sid,
    p_product_id: productId,
    p_variant_id: variantId,
    p_qty: ensurePositiveInt(qty, 1),
    p_unit_list: unit_list,
    p_unit_sale: unit_sale,
    p_label_kind: label_kind,
    p_label_text: label_text,
    p_snapshot: snapshot ?? {},
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] ?? null : data;
}

export async function updateItemQty(cartItemId: string, qty: number) {
  const supabase = await createServerSupabase();
  const sid = await resolveSessionId();
  await setSessionGUC(supabase, sid);

  const q = ensurePositiveInt(qty, 0);
  if (q === 0) {
    const { error: e } = await supabase.from("cart_items").delete().eq("id", cartItemId);
    if (e) throw e;
    return { deleted: true };
  }
  const { data, error } = await supabase
    .from("cart_items")
    .update({ qty: q })
    .eq("id", cartItemId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeItem(cartItemId: string) {
  const supabase = await createServerSupabase();
  const sid = await resolveSessionId();
  await setSessionGUC(supabase, sid);

  const { error } = await supabase.from("cart_items").delete().eq("id", cartItemId);
  if (error) throw error;
  return { deleted: true };
}

export async function attachUserToCart(userId: string) {
  const supabase = await createServerSupabase();
  const sid = await resolveSessionId();
  await setSessionGUC(supabase, sid);

  const { data: userCart, error: eUser } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (eUser) throw eUser;

  const { data: sessionCart, error: eSess } = await supabase
    .from("carts")
    .select("id")
    .eq("session_id", sid)
    .maybeSingle();
  if (eSess) throw eSess;

  if (!sessionCart && !userCart) {
    const { data: c, error } = await supabase
      .from("carts")
      .insert({ user_id: userId })
      .select("id")
      .single();
    if (error) throw error;
    return { cartId: c.id };
  }

  if (sessionCart && !userCart) {
    const { error } = await supabase
      .from("carts")
      .update({ user_id: userId })
      .eq("id", sessionCart.id);
    if (error) throw error;
    return { cartId: sessionCart.id, merged: false };
  }

  if (!sessionCart && userCart) {
    return { cartId: userCart.id, merged: false };
  }

  const targetId = userCart!.id;
  const sourceId = sessionCart!.id;

  const { data: srcItems, error: eLoad } = await supabase
    .from("cart_items")
    .select("*")
    .eq("cart_id", sourceId);
  if (eLoad) throw eLoad;

  for (const it of srcItems || []) {
    const { data: existing, error: eFind } = await supabase
      .from("cart_items")
      .select("id, qty, product_id, variant_id, snapshot")
      .eq("cart_id", targetId)
      .eq("dedupe_key", snapshotKey(it.product_id, it.variant_id, it.snapshot))
      .maybeSingle();
    if (eFind) throw eFind;

    if (existing) {
      const { error } = await supabase
        .from("cart_items")
        .update({ qty: Number(existing.qty ?? 0) + Number(it.qty ?? 0) })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("cart_items").insert({
        cart_id: targetId,
        product_id: it.product_id,
        variant_id: it.variant_id,
        qty: it.qty,
        unit_list: it.unit_list,
        unit_sale: it.unit_sale,
        label_kind: it.label_kind,
        label_text: it.label_text,
        snapshot: it.snapshot,
      });
      if (error) throw error;
    }
  }

  const { error: eDel } = await supabase.from("carts").delete().eq("id", sourceId);
  if (eDel) throw eDel;

  return { cartId: targetId, merged: true };
}
