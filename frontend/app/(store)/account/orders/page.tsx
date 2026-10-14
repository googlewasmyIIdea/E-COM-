import Link from "next/link";
import { serverRequest } from "@/features/commerce/server";
import type { Order } from "@/features/commerce/types";
import EmptyState from "@/components/ui/empty-state";
import { humanize, money } from "@/lib/utils";
export default async function Orders() {
  const orders = await serverRequest<Order[]>("orders", true);
  return (
    <section>
      <h2 className="mb-6 font-serif text-3xl">Your orders</h2>
      {orders.length ? (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/account/orders/${order.id}`}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-white p-6"
            >
              <div>
                <p className="font-semibold">{order.number}</p>
                <p className="mt-2 text-xs text-ink/70">
                  {new Date(order.created_at).toLocaleDateString("en-NP", {
                    timeZone: "Asia/Kathmandu",
                  })}{" "}
                  · {order.items.length} items
                </p>
              </div>
              <div className="flex items-center gap-5">
                <span className="rounded-full bg-mint/60 px-3 py-1.5 text-xs capitalize">
                  {humanize(order.status)}
                </span>
                <span className="text-sm font-semibold">
                  {money(order.total)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Your first little collection awaits"
          description="When you place an order, you’ll find it right here."
          href="/shop"
        />
      )}
    </section>
  );
}
