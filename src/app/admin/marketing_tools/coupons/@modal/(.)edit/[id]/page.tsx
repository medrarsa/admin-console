import Modal from "../../../../_components/Modal";
import PromoForm, { type Initial } from "../../../../_components/PromoForm";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

async function absoluteUrl(path: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}${path}`;
}

type ApiOut = {
  success: boolean;
  data?: {
    id: string;
    code: string;
    type: "fixed" | "percentage" | "f" | "p";
    status: string;
    amount: { amount: number; currency: string } | null;
    minimum_amount: number | null;
    maximum_amount: { amount: number; currency: string } | null;
    show_maximum_amount: boolean;
    starts_at: string | null;
    ends_at: string | null;
    free_shipping: boolean;
    usage_limit: number | null;
    usage_limit_per_user: number | null;
    applied_in: "all" | "web" | "app";
    promotion: {
      id: string;
      name: string | null;
      status: string | null;
      channels?: string[] | null;
      starts_at: string | null;
      ends_at: string | null;
      free_shipping: boolean | null;
      min_subtotal?: number | null;
      once_per_order?: boolean | null;
    };
  };
  error?: string;
};

function toInitial(api: NonNullable<ApiOut["data"]>): Initial {
  const discount_type: Initial["config"]["discount_type"] =
    api.type === "percentage" || api.type === "p" ? "percent" : "amount";

  return {
    promotion_id: api.promotion.id,
    id: api.id,
    kind: "coupon",
    status: (api.promotion.status as any) || api.status || "active",
    name: api.promotion.name || api.code,
    channels:
      Array.isArray(api.promotion.channels) && api.promotion.channels!.length
        ? (api.promotion.channels as string[])
        : ["web"],
    min_subtotal: api.minimum_amount ?? api.promotion.min_subtotal ?? null,
    once_per_order: api.promotion.once_per_order ?? true,
    usage_limit: api.usage_limit ?? null,
    per_customer_limit: api.usage_limit_per_user ?? null,
    starts_at: api.starts_at,
    ends_at: api.ends_at,
    free_shipping: api.free_shipping || !!api.promotion.free_shipping,
    config: {
      discount_type,
      value: api.amount?.amount ?? 0,
      max_discount: api.maximum_amount?.amount ?? null,
      code: api.code,
    },
  };
}

export default async function EditCouponModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const url = await absoluteUrl(`/api/admin/marketing_tools/promotions/${id}`);
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    return (
      <Modal title="تعديل كوبون">
        <div className="text-rose-600">
          تعذّر جلب بيانات الكوبون (HTTP {r.status}).
        </div>
      </Modal>
    );
  }
  const j = (await r.json()) as ApiOut;
  if (!j.success || !j.data) {
    return (
      <Modal title="تعديل كوبون">
        <div className="text-rose-600">
          لا توجد بيانات صالحة: {j.error ?? "غير معروف"}
        </div>
      </Modal>
    );
  }
  const initial = toInitial(j.data);
  return (
    <Modal title="تعديل كوبون">
      <PromoForm mode="edit" initial={initial} />
    </Modal>
  );
}
