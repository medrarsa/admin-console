export const dynamic = "force-dynamic";

import CartView from "../../(store-components)/cart/CartView";

export default function CartPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">سلة التسوّق</h1>
      <CartView />
    </main>
  );
}
