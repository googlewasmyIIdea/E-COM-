import Link from "next/link";
import { serverRequest } from "@/features/commerce/server";
import type { Stock } from "@/features/inventory/types";
export default async function Inventory() {
  const stock = await serverRequest<Stock[]>("inventory/stock", true);
  return (
    <section>
      <p className="eyebrow mb-4 text-coral-ink">
        Stock, holds, and your next delivery
      </p>
      <h1 className="font-serif text-4xl">A place for every lovely thing.</h1>
      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        {[
          { name: "Stock records", value: stock.length },
          {
            name: "Units on hand",
            value: stock.reduce((total, s) => total + s.quantity_on_hand, 0),
          },
          {
            name: "Reserved units",
            value: stock.reduce((total, s) => total + s.quantity_reserved, 0),
          },
        ].map((item) => (
          <div key={item.name} className="rounded-2xl bg-white p-7">
            <p className="text-xs text-ink/70">{item.name}</p>
            <p className="mt-4 text-3xl font-semibold">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-7 flex flex-wrap gap-3">
        {[
          "warehouses",
          "stock",
          "reservations",
          "replenishments",
          "alerts",
          "movements",
        ].map((resource) => (
          <Link
            href={`/inventory/${resource}`}
            key={resource}
            className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm capitalize"
          >
            {resource}
          </Link>
        ))}
      </div>
    </section>
  );
}
