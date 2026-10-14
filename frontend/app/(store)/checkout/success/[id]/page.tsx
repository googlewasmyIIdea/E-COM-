import Link from "next/link";
import { Flower2 } from "lucide-react";
import { requireCustomer, serverRequest } from "@/features/commerce/server";
import type { Order } from "@/features/commerce/types";
import { money } from "@/lib/utils";
export default async function OrderConfirmation({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCustomer();
  const { id } = await params;
  const order = await serverRequest<Order>(`orders/${id}`, true);
  return (
    <main className="page-width py-16">
      <section className="mx-auto max-w-xl rounded-3xl bg-mint/50 p-8 text-center sm:p-12">
        <Flower2
          size={48}
          strokeWidth={1.2}
          className="mx-auto mb-6 text-coral-ink"
        />
        <p className="eyebrow mb-4">A little happiness is on its way</p>
        <h1 className="font-serif text-4xl">Thank you for your order.</h1>
        <p className="mt-5 text-sm leading-7">
          Your order <strong>{order.number}</strong> has been saved.
          <br />
          Total: {money(order.total)}
          <br />
          {order.payment_method === "cod"
            ? "Payment will be collected on delivery."
            : `Payment status: ${order.payment_status}`}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/account/orders/${id}`}
            className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white"
          >
            View your order
          </Link>
          <Link
            href="/shop"
            className="rounded-full border border-ink/20 px-6 py-3 text-sm"
          >
            Keep exploring
          </Link>
        </div>
      </section>
    </main>
  );
}
