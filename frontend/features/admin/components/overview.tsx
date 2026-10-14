import Link from "next/link";
import {
  Package,
  Users,
  ShoppingBag,
  Wallet,
  ArrowUpRight,
  Bell,
} from "lucide-react";
import type { Overview as Data } from "@/features/commerce/types";
import { humanize, money } from "@/lib/utils";
export default function Overview({
  data,
  analytics = false,
}: {
  data: Data;
  analytics?: boolean;
}) {
  const max = Math.max(...data.revenue_by_day.map((d) => Number(d.revenue)), 1);
  return (
    <section>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-3 text-coral-ink">Your store, at a glance</p>
          <h1 className="font-serif text-3xl sm:text-4xl">
            {analytics ? "Store analytics" : "Good things are growing."}
          </h1>
          <p className="mt-3 text-sm text-ink/70">
            Live information from your store. No estimated sales or sample
            revenue.
          </p>
        </div>
        <Link
          href="/admin/products"
          className="flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-xs font-semibold text-white"
        >
          Manage products
          <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            name: "Products",
            value: data.products,
            icon: Package,
            color: "bg-lavender/50",
          },
          {
            name: "Customers",
            value: data.customers,
            icon: Users,
            color: "bg-mint/60",
          },
          {
            name: "Orders",
            value: data.orders,
            icon: ShoppingBag,
            color: "bg-peach/60",
          },
          {
            name: "Collected revenue",
            value: money(data.revenue),
            icon: Wallet,
            color: "bg-butter/60",
          },
        ].map((item) => (
          <article
            key={item.name}
            className="rounded-2xl border border-ink/5 bg-white p-6"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink/70">{item.name}</p>
              <span className={`rounded-xl p-2.5 ${item.color}`}>
                <item.icon size={17} />
              </span>
            </div>
            <p className="mt-5 text-2xl font-semibold">{item.value}</p>
          </article>
        ))}
      </div>
      <div className="mt-7 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <article className="rounded-2xl border border-ink/5 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Revenue this week</h2>
            <span className="text-xs text-ink/70">
              Collected payments · NPR
            </span>
          </div>
          <div
            className="mt-7 flex h-48 items-end justify-around gap-3 border-b border-ink/10 px-2"
            role="img"
            aria-label="Daily collected revenue chart"
          >
            {data.revenue_by_day.map((day) => (
              <div
                key={day.date}
                className="flex h-full flex-1 flex-col items-center justify-end"
              >
                <span className="mb-2 text-[10px] text-ink/70">
                  {money(day.revenue)}
                </span>
                <div
                  className="w-full max-w-10 rounded-t-lg bg-lavender"
                  style={{
                    height: `${(Number(day.revenue) / max) * 130 + 2}px`,
                  }}
                />
                <span className="-mb-6 mt-2 text-[9px] text-ink/70">
                  {day.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-10 text-xs text-ink/70">
            Cancelled, returned, and refunded orders are excluded.
          </p>
        </article>
        <article className="rounded-2xl border border-ink/5 bg-white p-6">
          <h2 className="mb-6 font-semibold">Things to keep an eye on</h2>
          {[
            {
              name: "Low-stock alerts",
              value: data.low_stock,
              href: "/inventory/alerts",
            },
            {
              name: "Active stock reservations",
              value: data.active_reservations,
              href: "/inventory/reservations",
            },
            {
              name: "Orders to prepare",
              value: data.pending_orders,
              href: "/admin/orders",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="mb-3 flex items-center justify-between rounded-xl bg-ivory px-4 py-4"
            >
              <span className="flex items-center gap-2 text-xs">
                <Bell size={14} className="text-coral-ink" />
                {item.name}
              </span>
              <span className="text-lg font-semibold">{item.value}</span>
            </Link>
          ))}
        </article>
      </div>
      <article className="mt-7 overflow-hidden rounded-2xl border border-ink/5 bg-white">
        <div className="flex items-center justify-between p-6">
          <h2 className="font-semibold">Recent orders</h2>
          <Link href="/admin/orders" className="text-xs underline">
            View all
          </Link>
        </div>
        {data.recent_orders.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-ivory text-ink/70">
                <tr>
                  {["Order", "Status", "Payment", "Total"].map((name) => (
                    <th key={name} className="px-6 py-3 font-medium">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recent_orders.map((order) => (
                  <tr key={order.id} className="border-t border-ink/5">
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/orders?order=${order.id}`}
                        className="font-semibold"
                      >
                        {order.number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 capitalize">
                      {humanize(order.status)}
                    </td>
                    <td className="px-6 py-4 capitalize">
                      {order.payment_status}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {money(order.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-6 pb-8 text-sm text-ink/70">
            No orders yet. Customer orders will appear here after checkout.
          </p>
        )}
      </article>
    </section>
  );
}
