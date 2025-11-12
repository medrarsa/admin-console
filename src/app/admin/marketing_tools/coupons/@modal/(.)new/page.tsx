import Modal from "../../../_components/Modal";
import PromoForm from "../../../_components/PromoForm";

export const dynamic = "force-dynamic";

export default function NewCouponModalPage() {
  return (
    <Modal title="إنشاء كوبون">
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
    </Modal>
  );
}
