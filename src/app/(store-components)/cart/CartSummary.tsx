"use client";

function CartSummary({
  totals,
}: {
  totals: { subtotal: number; discount: number; grand: number };
}) {
  const { subtotal, discount, grand } = totals;
  return (
    <div className="rounded-2xl border p-4 md:p-5">
      <h2 className="mb-4 text-lg font-semibold">الإجماليات</h2>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">المجموع</span>
          <span className="tabular-nums">{subtotal.toFixed(2)} ر.س</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">الخصم</span>
          <span className="tabular-nums">−{discount.toFixed(2)} ر.س</span>
        </div>
        <div className="border-t my-2" />
        <div className="flex items-center justify-between text-base font-semibold">
          <span>الإجمالي المستحق</span>
          <span className="tabular-nums">{grand.toFixed(2)} ر.س</span>
        </div>
      </div>
      <button
        type="button"
        className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-white hover:bg-emerald-700"
        onClick={() => alert("إكمال الشراء قريبًا ✅")}
      >
        إكمال الشراء
      </button>
    </div>
  );
}

export default CartSummary;
