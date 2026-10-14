import { serverRequest } from "@/features/commerce/server";
import type { DataRecord } from "@/features/commerce/types";
import { money } from "@/lib/utils";
export default async function Shipping() {
  const settings = await serverRequest<DataRecord[]>("store/settings");
  const fee = String(
    settings.find((s) => s.data.key === "shipping_standard")?.data.value ??
      "100",
  );
  const threshold = String(
    settings.find((s) => s.data.key === "free_shipping_threshold")?.data
      .value ?? "2500",
  );
  return (
    <main className="page-width py-16">
      <article className="mx-auto max-w-2xl">
        <p className="eyebrow mb-4 text-coral-ink">A little help</p>
        <h1 className="font-serif text-4xl">Shipping & delivery</h1>
        <div className="mt-7 space-y-5 text-sm leading-7 text-ink/70">
          <p>
            Delivery is currently offered within Nepal. Enter your complete
            address and a contact phone number at checkout.
          </p>
          <p>
            Standard delivery starts at {money(fee)}. Standard delivery is free
            when the merchandise subtotal reaches {money(threshold)}. Express
            delivery adds NPR 100 to the standard fee unless free shipping
            applies.
          </p>
          <p>
            Your final delivery fee is calculated at checkout. Cash on Delivery
            is collected when your order is delivered. Tracking information
            appears in your account once assigned by the store.
          </p>
          <p>
            Availability for backorders and preorders is shown on product pages.
            Those orders may wait for stock before packing and shipment.
          </p>
        </div>
      </article>
    </main>
  );
}
