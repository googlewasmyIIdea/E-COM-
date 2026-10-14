"use client";
import { useState, type FormEvent } from "react";
import Button from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { request } from "@/features/commerce/client";
import type { DataRecord, JsonValue } from "@/features/commerce/types";
import type { Resource } from "../config";
import { inventoryResources } from "../config";
import { message } from "@/lib/utils";
export interface Lookups {
  warehouses: DataRecord[];
  variants: DataRecord[];
  stock: DataRecord[];
  categories: DataRecord[];
  collections: DataRecord[];
}
type FormField = {
  name: string;
  label: string;
  type?: "text" | "number" | "textarea" | "select" | "checkbox" | "date";
  options?: { value: string; label: string }[];
  required?: boolean;
  default?: string | boolean;
  step?: string;
  min?: number;
};
export default function RecordForm({
  resource,
  row,
  lookups,
  onSaved,
}: {
  resource: Resource;
  row?: DataRecord;
  lookups: Lookups;
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const warehouseOptions = lookups.warehouses.map((r) => ({
    value: r.id,
    label: String(r.data.name),
  }));
  const variantOptions = lookups.variants.map((r) => ({
    value: r.id,
    label: `${String(r.data.sku)} · ${String(r.data.name)}`,
  }));
  const stockOptions = lookups.stock.map((r) => ({
    value: r.id,
    label: `${String(r.data.sku)} · ${String(r.data.warehouse_name)}`,
  }));
  const choice = (...values: string[]) =>
    values.map((v) => ({ value: v, label: v.replaceAll("_", " ") }));
  let fields: FormField[] = [];
  if (resource === "warehouses")
    fields = [
      { name: "name", label: "Warehouse name", required: true },
      { name: "code", label: "Warehouse code", required: true },
      { name: "location", label: "Location", required: true },
      { name: "address", label: "Address", type: "textarea" },
      {
        name: "active",
        label: "Active warehouse",
        type: "checkbox",
        default: true,
      },
    ];
  if (resource === "stock")
    fields = row
      ? [
          {
            name: "reorder_point",
            label: "Low-stock threshold",
            type: "number",
            min: 0,
            required: true,
          },
        ]
      : [
          {
            name: "warehouse_id",
            label: "Warehouse",
            type: "select",
            options: warehouseOptions,
            required: true,
          },
          {
            name: "variant_id",
            label: "Product variant / SKU",
            type: "select",
            options: variantOptions,
            required: true,
          },
          {
            name: "quantity_on_hand",
            label: "Initial quantity",
            type: "number",
            min: 0,
            default: "0",
            required: true,
          },
          {
            name: "reorder_point",
            label: "Low-stock threshold",
            type: "number",
            min: 0,
            default: "5",
            required: true,
          },
        ];
  if (resource === "reservations")
    fields = [
      {
        name: "stock_id",
        label: "Stock to reserve",
        type: "select",
        options: stockOptions,
        required: true,
      },
      {
        name: "quantity",
        label: "Quantity",
        type: "number",
        min: 1,
        required: true,
      },
    ];
  if (resource === "replenishments")
    fields = [
      {
        name: "stock_id",
        label: "Stock / warehouse",
        type: "select",
        options: stockOptions,
        required: true,
      },
      {
        name: "quantity",
        label: "Expected quantity",
        type: "number",
        min: 1,
        required: true,
      },
      {
        name: "kind",
        label: "Replenishment type",
        type: "select",
        options: choice("backorder", "preorder"),
        default: "backorder",
      },
      { name: "expected_at", label: "Expected arrival", type: "date" },
      { name: "supplier", label: "Supplier" },
    ];
  if (resource === "categories" || resource === "collections")
    fields = [
      { name: "name", label: "Name", required: true },
      { name: "slug", label: "URL name", required: true },
      { name: "description", label: "Description", type: "textarea" },
      {
        name: "image",
        label: "Image path",
        default: "/images/stationery-hero.webp",
      },
      { name: "active", label: "Active", type: "checkbox", default: true },
      ...(resource === "categories"
        ? [
            {
              name: "parent_id",
              label: "Parent category (optional)",
              type: "select" as const,
              options: lookups.categories
                .filter((c) => c.id !== row?.id)
                .map((c) => ({ value: c.id, label: String(c.data.name) })),
            },
          ]
        : []),
    ];
  if (resource === "coupons")
    fields = [
      { name: "code", label: "Coupon code", required: true },
      {
        name: "kind",
        label: "Discount type",
        type: "select",
        options: choice("percentage", "fixed", "free_shipping"),
        default: "percentage",
      },
      {
        name: "value",
        label: "Discount value",
        type: "number",
        min: 0,
        step: "0.01",
        default: "10",
      },
      {
        name: "min_spend",
        label: "Minimum spend (NPR)",
        type: "number",
        min: 0,
        step: "0.01",
        default: "0",
      },
      {
        name: "max_uses",
        label: "Usage limit (optional)",
        type: "number",
        min: 1,
      },
      { name: "starts_at", label: "Starts on", type: "date" },
      { name: "expires_at", label: "Expires on", type: "date" },
      { name: "active", label: "Active", type: "checkbox", default: true },
    ];
  if (resource === "promotions")
    fields = [
      { name: "name", label: "Promotion name", required: true },
      { name: "headline", label: "Headline", required: true },
      { name: "body", label: "Supporting copy", type: "textarea" },
      { name: "link", label: "Destination page", default: "/shop" },
      {
        name: "image",
        label: "Image path",
        default: "/images/stationery-hero.webp",
      },
      { name: "starts_at", label: "Starts on", type: "date" },
      { name: "expires_at", label: "Ends on", type: "date" },
      { name: "active", label: "Active", type: "checkbox", default: true },
    ];
  if (resource === "settings")
    fields = [
      { name: "key", label: "Setting name", required: true },
      { name: "value", label: "Value", type: "textarea", required: true },
      {
        name: "public",
        label: "Visible on storefront",
        type: "checkbox",
        default: false,
      },
    ];
  if (resource === "customers")
    fields = [
      { name: "name", label: "Name" },
      { name: "phone", label: "Phone" },
      {
        name: "role",
        label: "Account role",
        type: "select",
        options: choice("customer", "staff", "admin"),
      },
      {
        name: "is_active",
        label: "Account active",
        type: "checkbox",
        default: true,
      },
      { name: "permissions", label: "Staff permissions (comma-separated)" },
    ];
  if (resource === "orders") {
    const transitions: Record<string, string[]> = {
      pending_payment: ["pending_payment", "cancelled"],
      paid: ["paid", "processing", "cancelled"],
      awaiting_stock: ["awaiting_stock", "cancelled"],
      awaiting_release: ["awaiting_release", "cancelled"],
      processing: ["processing", "packed", "cancelled"],
      packed: ["packed", "shipped", "cancelled"],
      shipped: ["shipped", "delivered"],
      delivered: ["delivered", "returned"],
      returned: ["returned", "refunded"],
      cancelled: ["cancelled"],
      refunded: ["refunded"],
    };
    fields = [
      {
        name: "status",
        label: "Order status",
        type: "select",
        options: choice(...(transitions[String(row?.data.status)] ?? [])),
      },
      { name: "tracking_number", label: "Tracking number" },
      { name: "notes", label: "Staff notes", type: "textarea" },
    ];
  }
  if (resource === "reviews")
    fields = [
      {
        name: "status",
        label: "Moderation status",
        type: "select",
        options: choice("pending", "approved", "rejected"),
      },
    ];
  if (resource === "returns")
    fields = [
      {
        name: "status",
        label: "Return status",
        type: "select",
        options: choice(
          "requested",
          "approved",
          "rejected",
          "received",
          "refunded",
        ),
      },
      { name: "notes", label: "Staff notes", type: "textarea" },
    ];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values: Record<string, JsonValue> = {};
    for (const field of fields) {
      const raw = String(form.get(field.name) ?? "");
      if (field.type === "checkbox")
        values[field.name] = form.get(field.name) === "on";
      else if (field.type === "number")
        values[field.name] = raw ? (field.step ? raw : Number(raw)) : null;
      else if (field.type === "date")
        values[field.name] = raw ? new Date(raw).toISOString() : null;
      else if (field.name === "parent_id") values[field.name] = raw || null;
      else if (field.name === "permissions")
        values[field.name] = raw
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
      else values[field.name] = raw;
    }
    setPending(true);
    setError("");
    try {
      await request(
        `${inventoryResources.has(resource) ? "inventory" : "admin"}/${resource}${row ? "/" + row.id : ""}`,
        { method: row ? "PATCH" : "POST", body: values },
      );
      onSaved();
    } catch (failure) {
      setError(message(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      {fields.map((field) => {
        const value = row?.data[field.name] ?? field.default ?? "";
        const inputId = `record-${field.name}`;
        if (field.type === "checkbox")
          return (
            <label key={field.name} className="flex items-center gap-2 text-sm">
              <input
                name={field.name}
                type="checkbox"
                defaultChecked={!!value}
              />
              {field.label}
            </label>
          );
        return (
          <Field key={field.name} htmlFor={inputId} label={field.label}>
            {field.type === "select" ? (
              <select
                id={inputId}
                name={field.name}
                className="select-field"
                defaultValue={String(value)}
                required={field.required}
              >
                <option value="">Select an option</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea
                id={inputId}
                name={field.name}
                className="select-field min-h-24"
                defaultValue={
                  typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value)
                }
                required={field.required}
              />
            ) : (
              <Input
                id={inputId}
                name={field.name}
                type={
                  field.type === "date"
                    ? "date"
                    : field.type === "number"
                      ? "number"
                      : "text"
                }
                defaultValue={
                  field.type === "date"
                    ? String(value).slice(0, 10)
                    : Array.isArray(value)
                      ? value.join(", ")
                      : String(value)
                }
                required={field.required}
                step={field.step}
                min={field.min}
              />
            )}
          </Field>
        );
      })}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
