import { requireCustomer, serverRequest } from "@/features/commerce/server";
import type { DataRecord, PaymentOptions } from "@/features/commerce/types";
import CheckoutForm from "@/features/storefront/components/checkout-form";
export default async function Checkout() {
  const user = await requireCustomer();
  const [addresses, payments] = await Promise.all([
    serverRequest<DataRecord[]>("account/addresses", true),
    serverRequest<PaymentOptions>("store/payment-options"),
  ]);
  return (
    <main className="page-width py-12">
      <p className="eyebrow mb-4 text-coral-ink">One more little step</p>
      <h1 className="mb-10 font-serif text-4xl sm:text-5xl">Make it yours.</h1>
      <CheckoutForm user={user} addresses={addresses} payments={payments} />
    </main>
  );
}
