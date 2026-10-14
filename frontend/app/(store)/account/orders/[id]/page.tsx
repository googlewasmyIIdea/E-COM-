import { serverRequest } from "@/features/commerce/server";
import type { Order } from "@/features/commerce/types";
import ProductImage from "@/features/storefront/components/product-image";
import OrderActions from "@/features/storefront/components/order-actions";
import { humanize, money } from "@/lib/utils";
export default async function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await serverRequest<Order>(`orders/${id}`, true);
  return (
    <section>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-serif text-3xl">{order.number}</h2>
        <span className="rounded-full bg-mint px-4 py-2 text-sm capitalize">
          {humanize(order.status)}
        </span>
      </div>
      <div className="grid gap-7 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {order.items.map((item) => (
            <article
              key={item.id}
              className="flex items-center gap-5 rounded-2xl bg-white p-5"
            >
              <div className="relative size-20 overflow-hidden rounded-xl">
                <ProductImage
                  src={item.image}
                  alt={item.product_name}
                  sizes="80px"
                />
              </div>
              <div className="flex-1">
                <p className="font-medium">{item.product_name}</p>
                <p className="mt-2 text-xs text-ink/70">
                  {item.variant_name} · {item.quantity} ×{" "}
                  {money(item.unit_price)}
                </p>
                {item.allocated < item.quantity && (
                  <p className="mt-2 text-xs text-coral-ink">
                    Awaiting stock: {item.quantity - item.allocated}
                  </p>
                )}
              </div>
              <span className="text-sm font-semibold">{money(item.total)}</span>
            </article>
          ))}
          <OrderActions order={order} />
        </div>
        <aside className="h-fit rounded-2xl bg-white p-6">
          <h3 className="font-serif text-xl">Order details</h3>
          <dl className="mt-5 space-y-3 text-sm">
            {[
              ["Subtotal", money(order.subtotal)],
              ["Discount", money(order.discount)],
              ["Delivery", money(order.shipping)],
              ["Total", money(order.total)],
              [
                "Payment",
                humanize(order.payment_method) +
                  " / " +
                  humanize(order.payment_status),
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-ink/70">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 border-t border-ink/10 pt-5">
            <h4 className="mb-3 text-sm font-semibold">Delivery address</h4>
            {["name", "line1", "line2", "city", "phone"].map((key) => (
              <p key={key} className="text-sm leading-6 text-ink/70">
                {String(order.address[key] ?? "")}
              </p>
            ))}
          </div>
          {order.tracking_number && (
            <p className="mt-5 text-sm">Tracking: {order.tracking_number}</p>
          )}
        </aside>
      </div>
    </section>
  );
}
