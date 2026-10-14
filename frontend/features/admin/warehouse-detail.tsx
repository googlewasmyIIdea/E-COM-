import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Boxes, PackageCheck, Warehouse } from "lucide-react";
import {
  BackendError,
  requireManagement,
  serverRequest,
} from "@/features/commerce/server";
import type { JsonValue } from "@/features/commerce/types";

export default async function WarehouseDetail({ id }: { id: string }) {
  await requireManagement("inventory.view");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  let warehouse: Record<string, JsonValue>;
  try {
    warehouse = await serverRequest<Record<string, JsonValue>>(
      `inventory/warehouses/${id}`,
      true,
    );
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) notFound();
    throw error;
  }
  const rows = (
    await serverRequest<Record<string, JsonValue>[]>("inventory/stock", true)
  ).filter((row) => row.warehouse_id === id);
  const quantities = rows.reduce<{
    total: number;
    reserved: number;
    available: number;
  }>(
    (sum, row) => ({
      total: sum.total + Number(row.quantity_on_hand),
      reserved: sum.reserved + Number(row.quantity_reserved),
      available: sum.available + Number(row.available_stock),
    }),
    { total: 0, reserved: 0, available: 0 },
  );
  return (
    <section>
      <Link
        href="/inventory/warehouses"
        className="mb-7 inline-flex items-center gap-2 text-sm"
      >
        <ArrowLeft size={16} /> Warehouses
      </Link>
      <p className="eyebrow mb-3 text-coral-ink">Warehouse details</p>
      <h1 className="font-serif text-3xl sm:text-4xl">
        {String(warehouse.name)}
      </h1>
      <p className="mt-3 text-sm text-ink/70">
        {String(warehouse.code)} · {String(warehouse.location)} ·{" "}
        {warehouse.active ? "Active" : "Inactive"}
      </p>
      {!!warehouse.address && (
        <p className="mt-3 whitespace-pre-line text-sm">
          {String(warehouse.address)}
        </p>
      )}
      <div className="my-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Quantity on hand",
            value: quantities.total,
            Icon: Warehouse,
          },
          { label: "Reserved units", value: quantities.reserved, Icon: Boxes },
          {
            label: "Available units",
            value: quantities.available,
            Icon: PackageCheck,
          },
        ].map(({ label, value, Icon }) => (
          <article
            key={label}
            className="rounded-2xl border border-ink/10 bg-white p-6"
          >
            <Icon size={20} className="mb-4 text-coral-ink" />
            <p className="text-sm text-ink/70">{label}</p>
            <p className="mt-2 font-serif text-3xl">{value}</p>
          </article>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white">
        <table className="w-full text-left text-sm">
          <caption className="p-5 text-left font-semibold">
            {rows.length} SKU records at this location
          </caption>
          <thead className="border-y border-ink/10 bg-ivory">
            <tr>
              {[
                "Product / SKU",
                "On hand",
                "Reserved",
                "Available",
                "Reorder point",
              ].map((label) => (
                <th
                  key={label}
                  className="whitespace-nowrap p-4 text-xs font-medium"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)} className="border-b border-ink/5">
                <td className="p-4">
                  {String(row.product_name)}
                  <p className="mt-1 text-xs text-ink/70">{String(row.sku)}</p>
                </td>
                {[
                  "quantity_on_hand",
                  "quantity_reserved",
                  "available_stock",
                  "reorder_point",
                ].map((key) => (
                  <td key={key} className="p-4">
                    {String(row[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-6 text-sm text-ink/70">
            No stock has been recorded here yet.
          </p>
        )}
      </div>
      <Link
        href={`/inventory/stock?warehouse=${id}`}
        className="mt-6 inline-flex rounded-full bg-ink px-6 py-3 text-sm text-white"
      >
        Manage location stock
      </Link>
    </section>
  );
}
