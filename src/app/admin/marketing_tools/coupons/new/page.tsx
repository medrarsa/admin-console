// src/app/admin/marketing_tools/coupons/new/page.tsx
export const dynamic = "force-dynamic";

import PromoForm from "../../_components/PromoForm";

export default function NewCouponPage() {
  return (
    <div className="p-6" dir="rtl">
      <h1 className="text-2xl font-bold mb-4">إنشاء كوبون تخفيض</h1>
      <PromoForm
        mode="create"
        initial={{
          kind: "coupon",
          status: "active",
          name: "",
          channels: ["web"],
          config: {
            discount_type: "amount",
            value: 0,
            max_discount: null,
            code: "",
          },
          min_subtotal: null,
          once_per_order: true,
          usage_limit: null,
          per_customer_limit: null,
          starts_at: null,
          ends_at: null,
          free_shipping: false,
        }}
      />
    </div>
  );
}
