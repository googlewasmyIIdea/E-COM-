"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import Button from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import Modal from "@/components/ui/modal";
import EmptyState from "@/components/ui/empty-state";
import { request } from "@/features/commerce/client";
import type {
  DataRecord,
  JsonValue,
  Order,
  Product,
} from "@/features/commerce/types";
import {
  columns,
  creatable,
  inventoryResources,
  readOnly,
  titles,
  type Resource,
} from "../config";
import RecordForm, { type Lookups } from "./record-form";
import ProductEditor from "./product-editor";
import { humanize, message, money } from "@/lib/utils";

type Action = {
  kind: "adjust" | "transfer" | "receive" | "cancel" | "delete" | "acknowledge";
  row: DataRecord;
};
function display(key: string, value: JsonValue | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (["price", "total", "amount"].includes(key)) return money(String(value));
  if (key.endsWith("_at"))
    return new Date(String(value)).toLocaleString("en-NP", {
      timeZone: "Asia/Kathmandu",
      dateStyle: "medium",
      timeStyle: "short",
    });
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
export default function ManagementTable({
  resource,
  rows,
  total,
  page = 1,
  q = "",
  lookups,
  canManage = true,
  warehouse,
}: {
  resource: Resource;
  rows: DataRecord[];
  total: number;
  page?: number;
  q?: string;
  lookups: Lookups;
  canManage?: boolean;
  warehouse?: string;
}) {
  const router = useRouter();
  const [editor, setEditor] = useState(false);
  const [selected, setSelected] = useState<DataRecord | undefined>();
  const [product, setProduct] = useState<Product | undefined>();
  const [order, setOrder] = useState<Order | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!inventoryResources.has(resource)) return;
    const timer = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(timer);
  }, [resource, router]);
  const base = `${inventoryResources.has(resource) ? "inventory" : "admin"}/${resource}`;
  function saved() {
    setEditor(false);
    setAction(null);
    setSelected(undefined);
    setProduct(undefined);
    setNotice("Saved. The store has been updated.");
    router.refresh();
  }
  async function edit(row: DataRecord) {
    setError("");
    setSelected(row);
    if (resource === "products") {
      try {
        setProduct(await request<Product>(`admin/products/${row.id}`));
      } catch (f) {
        setError(message(f));
        return;
      }
    }
    setEditor(true);
  }
  async function viewOrder(row: DataRecord) {
    try {
      setOrder(await request<Order>(`admin/orders/${row.id}`));
    } catch (f) {
      setError(message(f));
    }
  }
  async function runAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action) return;
    const form = new FormData(event.currentTarget);
    const { kind, row } = action;
    setPending(true);
    setError("");
    try {
      if (kind === "adjust")
        await request(`inventory/stock/${row.id}/adjust`, {
          method: "POST",
          body: {
            delta: Number(form.get("delta")),
            reason: String(form.get("reason")),
          },
        });
      if (kind === "transfer")
        await request("inventory/transfers", {
          method: "POST",
          body: {
            stock_id: row.id,
            destination_warehouse_id: String(
              form.get("destination_warehouse_id"),
            ),
            quantity: Number(form.get("quantity")),
            reason: String(form.get("reason")),
          },
        });
      if (kind === "receive")
        await request(`inventory/replenishments/${row.id}/receive`, {
          method: "POST",
          body: { quantity: Number(form.get("quantity")) },
        });
      if (kind === "cancel")
        await request(`${base}/${row.id}/cancel`, { method: "POST" });
      if (kind === "delete")
        await request(`${base}/${row.id}`, { method: "DELETE" });
      if (kind === "acknowledge")
        await request(`inventory/alerts/${row.id}`, {
          method: "PATCH",
          body: { status: "acknowledged" },
        });
      saved();
    } catch (f) {
      setError(message(f));
    } finally {
      setPending(false);
    }
  }
  async function expire() {
    setPending(true);
    try {
      const result = await request<{ detail: string }>(
        "inventory/reservations/expire",
        { method: "POST" },
      );
      setNotice(result.detail);
      router.refresh();
    } catch (f) {
      setError(message(f));
    } finally {
      setPending(false);
    }
  }
  const pagePath = inventoryResources.has(resource)
    ? `/inventory/${resource}`
    : `/admin/${resource}`;
  function pageHref(number: number) {
    return `${pagePath}?page=${number}&q=${encodeURIComponent(q)}${warehouse ? `&warehouse=${encodeURIComponent(warehouse)}` : ""}`;
  }
  return (
    <section>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-3 text-coral-ink">
            {inventoryResources.has(resource)
              ? "Inventory operations"
              : "Store management"}
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl">
            {titles[resource]}
          </h1>
          <p className="mt-3 text-xs text-ink/70">
            {total} records · Manage your latest store information.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => router.refresh()}
            aria-label="Refresh records"
          >
            <RefreshCw size={15} />
          </Button>
          {resource === "reservations" && canManage && (
            <Button variant="secondary" onClick={expire} disabled={pending}>
              Expire old holds
            </Button>
          )}
          {creatable.has(resource) && canManage && (
            <Button
              onClick={() => {
                setSelected(undefined);
                setProduct(undefined);
                setEditor(true);
              }}
            >
              <Plus size={16} />
              Add{" "}
              {resource === "stock"
                ? "stock"
                : resource === "categories"
                  ? "category"
                  : resource === "replenishments"
                    ? "replenishment"
                    : resource === "settings"
                      ? "setting"
                      : resource.slice(0, -1)}
            </Button>
          )}
        </div>
      </div>
      <form action={pagePath} className="mb-5 flex max-w-md gap-2">
        {warehouse && (
          <input type="hidden" name="warehouse" value={warehouse} />
        )}
        <label className="sr-only" htmlFor="management-search">
          Search {titles[resource]}
        </label>
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-3.5 text-ink/70" />
          <Input
            id="management-search"
            name="q"
            defaultValue={q}
            placeholder={`Search ${titles[resource].toLowerCase()}…`}
            className="pl-10"
          />
        </div>
        <Button variant="secondary" type="submit">
          Search
        </Button>
      </form>
      {notice && (
        <p
          role="status"
          className="mb-4 rounded-xl bg-mint/70 p-4 text-sm text-emerald-900"
        >
          {notice}
        </p>
      )}
      {error && !editor && !action && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-ink/8 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-ivory/80 text-ink/70">
              <tr>
                {columns[resource].map((key) => (
                  <th
                    key={key}
                    className="whitespace-nowrap px-5 py-4 font-medium capitalize"
                  >
                    {humanize(key)}
                  </th>
                ))}
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-ink/5 hover:bg-ivory/40"
                >
                  {columns[resource].map((key) => (
                    <td key={key} className="max-w-60 px-5 py-4">
                      {["status", "role", "payment_status"].includes(key) ? (
                        <span className="inline-block whitespace-nowrap rounded-full bg-lavender/35 px-2.5 py-1 capitalize">
                          {display(key, row.data[key])}
                        </span>
                      ) : (
                        <span className="line-clamp-2">
                          {display(key, row.data[key])}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {resource === "products" && (
                        <Link
                          href={`/products/${String(row.data.slug)}`}
                          target="_blank"
                          aria-label={`View ${String(row.data.name)}`}
                          className="icon-button"
                        >
                          <Eye size={14} />
                        </Link>
                      )}
                      {resource === "warehouses" && (
                        <Link
                          href={`/inventory/warehouses/${row.id}`}
                          aria-label={`View warehouse ${String(row.data.name)}`}
                          className="icon-button"
                        >
                          <Eye size={14} />
                        </Link>
                      )}
                      {resource === "orders" && (
                        <button
                          onClick={() => viewOrder(row)}
                          aria-label={`View order ${String(row.data.number)}`}
                          className="icon-button"
                        >
                          <Eye size={14} />
                        </button>
                      )}
                      {canManage &&
                        !readOnly.has(resource) &&
                        !["alerts", "reservations", "replenishments"].includes(
                          resource,
                        ) && (
                          <button
                            onClick={() => edit(row)}
                            aria-label={`Edit ${String(row.data.name ?? row.data.code ?? row.data.number ?? row.data.title ?? titles[resource])}`}
                            className="icon-button"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                      {canManage && resource === "stock" && (
                        <>
                          <button
                            onClick={() => setAction({ kind: "adjust", row })}
                            className="rounded-lg border border-ink/10 px-3 py-2"
                          >
                            Adjust
                          </button>
                          <button
                            onClick={() => setAction({ kind: "transfer", row })}
                            className="rounded-lg border border-ink/10 px-3 py-2"
                          >
                            Transfer
                          </button>
                        </>
                      )}
                      {canManage &&
                        resource === "replenishments" &&
                        ["pending", "partial"].includes(
                          String(row.data.status),
                        ) && (
                          <>
                            <button
                              onClick={() =>
                                setAction({ kind: "receive", row })
                              }
                              className="rounded-lg bg-mint/50 px-3 py-2"
                            >
                              Receive
                            </button>
                            <button
                              onClick={() => setAction({ kind: "cancel", row })}
                              className="rounded-lg border border-ink/10 px-3 py-2"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      {canManage &&
                        resource === "reservations" &&
                        row.data.status === "active" && (
                          <button
                            onClick={() => setAction({ kind: "cancel", row })}
                            className="rounded-lg border border-ink/10 px-3 py-2"
                          >
                            Cancel hold
                          </button>
                        )}
                      {canManage &&
                        resource === "alerts" &&
                        row.data.status === "open" && (
                          <button
                            onClick={() =>
                              setAction({ kind: "acknowledge", row })
                            }
                            className="rounded-lg bg-butter/60 px-3 py-2"
                          >
                            Acknowledge
                          </button>
                        )}
                      {canManage &&
                        [
                          "products",
                          "categories",
                          "collections",
                          "warehouses",
                          "coupons",
                          "promotions",
                          "settings",
                          "reviews",
                        ].includes(resource) && (
                          <button
                            onClick={() => setAction({ kind: "delete", row })}
                            aria-label={`Remove ${String(row.data.name ?? row.data.code ?? row.data.key ?? row.data.title)}`}
                            className="icon-button text-ink/70"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={`No ${titles[resource].toLowerCase()} found`}
          description={
            q
              ? "Try a different search."
              : "New records will appear here after you create them or complete the relevant store workflow."
          }
        />
      )}
      {total > 30 && (
        <nav
          aria-label="Management pages"
          className="mt-6 flex items-center justify-center gap-4"
        >
          {page > 1 && (
            <Link
              href={pageHref(page - 1)}
              aria-label="Previous page"
              className="icon-button"
            >
              <ArrowLeft size={16} />
            </Link>
          )}
          <span className="text-xs">
            Page {page} of {Math.ceil(total / 30)}
          </span>
          {page < Math.ceil(total / 30) && (
            <Link
              href={pageHref(page + 1)}
              aria-label="Next page"
              className="icon-button"
            >
              <ArrowRight size={16} />
            </Link>
          )}
        </nav>
      )}
      <Modal
        title={`${selected ? "Edit" : "Add"} ${titles[resource].toLowerCase()}`}
        open={editor}
        onClose={() => setEditor(false)}
      >
        {resource === "products" ? (
          <ProductEditor
            key={product?.id ?? "new"}
            product={product}
            categories={lookups.categories}
            collections={lookups.collections}
            onSaved={saved}
          />
        ) : (
          <RecordForm
            key={selected?.id ?? "new"}
            resource={resource}
            row={selected}
            lookups={lookups}
            onSaved={saved}
          />
        )}
      </Modal>
      <Modal
        title={
          action
            ? `${humanize(action.kind)} ${resource === "stock" ? "stock" : "record"}`
            : ""
        }
        open={!!action}
        onClose={() => setAction(null)}
      >
        <form onSubmit={runAction} className="space-y-4">
          {action?.kind === "adjust" && (
            <>
              <p className="text-sm text-ink/70">
                {String(action.row.data.sku)} ·{" "}
                {String(action.row.data.warehouse_name)}
                <br />
                Available: {String(action.row.data.available_stock)}
              </p>
              <Field htmlFor="stock-delta" label="Quantity change">
                <Input
                  id="stock-delta"
                  name="delta"
                  type="number"
                  required
                  placeholder="e.g. 5 to receive, -2 to remove"
                />
              </Field>
              <Field htmlFor="adjust-reason" label="Reason">
                <Input
                  id="adjust-reason"
                  name="reason"
                  required
                  minLength={3}
                />
              </Field>
            </>
          )}
          {action?.kind === "transfer" && (
            <>
              <Field
                htmlFor="transfer-destination"
                label="Destination warehouse"
              >
                <select
                  id="transfer-destination"
                  name="destination_warehouse_id"
                  className="select-field"
                  required
                >
                  {lookups.warehouses
                    .filter((w) => w.id !== action.row.data.warehouse_id)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {String(w.data.name)}
                      </option>
                    ))}
                </select>
              </Field>
              <Field htmlFor="transfer-quantity" label="Quantity">
                <Input
                  id="transfer-quantity"
                  name="quantity"
                  type="number"
                  min={1}
                  required
                />
              </Field>
              <Field htmlFor="transfer-reason" label="Reason">
                <Input
                  id="transfer-reason"
                  name="reason"
                  minLength={3}
                  required
                />
              </Field>
            </>
          )}
          {action?.kind === "receive" && (
            <Field htmlFor="receipt-quantity" label="Quantity received">
              <Input
                id="receipt-quantity"
                name="quantity"
                type="number"
                min={1}
                max={
                  Number(action.row.data.quantity) -
                  Number(action.row.data.received_quantity)
                }
                required
              />
            </Field>
          )}
          {action &&
            ["delete", "cancel", "acknowledge"].includes(action.kind) && (
              <p className="text-sm leading-6 text-ink/70">
                {action.kind === "delete"
                  ? "Referenced products and taxonomy are deactivated to preserve order history. Warehouse removal is blocked when stock history exists."
                  : action.kind === "cancel"
                    ? "This action is idempotent. Any active reservation will be released once."
                    : "Mark this alert as acknowledged. It will resolve automatically when available stock rises above its threshold."}
              </p>
            )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={pending}
            variant={action?.kind === "delete" ? "danger" : "primary"}
            className="w-full"
          >
            {pending ? "Saving…" : "Confirm"}
          </Button>
        </form>
      </Modal>
      <Modal
        title={order?.number ?? "Order details"}
        open={!!order}
        onClose={() => setOrder(null)}
      >
        {order && (
          <div className="space-y-4">
            <p className="text-sm">
              Status: {humanize(order.status)} · Payment: {order.payment_status}
            </p>
            <div className="rounded-xl bg-white p-4 text-sm leading-6">
              {["name", "line1", "line2", "city", "phone"].map((key) => (
                <p key={key}>{String(order.address[key] ?? "")}</p>
              ))}
            </div>
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-4 text-sm">
                <span>
                  {item.product_name} · {item.variant_name} × {item.quantity}
                </span>
                <span>{money(item.total)}</span>
              </div>
            ))}
            <p className="border-t border-ink/10 pt-4 text-right font-semibold">
              Total: {money(order.total)}
            </p>
            <a
              href={`/api/commerce/orders/${order.id}/invoice`}
              className="text-sm underline"
            >
              Download invoice
            </a>
          </div>
        )}
      </Modal>
    </section>
  );
}
