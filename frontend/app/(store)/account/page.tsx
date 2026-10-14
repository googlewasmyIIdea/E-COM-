import Link from "next/link";
import { Heart, MapPin, Package, Settings } from "lucide-react";
import { requireCustomer, serverRequest } from "@/features/commerce/server";
import type { DataRecord, Order } from "@/features/commerce/types";
export default async function Account() {
  await requireCustomer();
  const [orders, wishlist, addresses] = await Promise.all([
    serverRequest<Order[]>("orders", true),
    serverRequest<DataRecord[]>("account/wishlist", true),
    serverRequest<DataRecord[]>("account/addresses", true),
  ]);
  return (
    <section>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            href: "/account/orders",
            label: "Your orders",
            value: orders.length,
            icon: Package,
          },
          {
            href: "/account/wishlist",
            label: "Saved favourites",
            value: wishlist.length,
            icon: Heart,
          },
          {
            href: "/account/addresses",
            label: "Saved addresses",
            value: addresses.length,
            icon: MapPin,
          },
          {
            href: "/account/settings",
            label: "Account settings",
            value: "Manage",
            icon: Settings,
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border border-ink/10 bg-white p-6"
          >
            <item.icon size={22} strokeWidth={1.5} className="text-coral-ink" />
            <p className="mt-5 font-serif text-3xl">{item.value}</p>
            <p className="mt-2 text-sm text-ink/70">{item.label}</p>
          </Link>
        ))}
      </div>
      <div className="mt-8 rounded-2xl bg-lavender/30 p-8">
        <h2 className="font-serif text-2xl">
          Ready for your next lovely find?
        </h2>
        <p className="mt-3 text-sm text-ink/70">
          Fresh notebooks, thoughtful gifts, and a little inspiration for your
          everyday.
        </p>
        <Link
          href="/shop"
          className="mt-5 inline-block text-sm font-semibold underline"
        >
          Explore the shop →
        </Link>
      </div>
    </section>
  );
}
