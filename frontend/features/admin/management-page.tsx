import { notFound } from "next/navigation";
import { requireManagement, serverRequest } from "@/features/commerce/server";
import type {
  DataRecord,
  JsonValue,
  RecordPage,
  Taxonomy,
} from "@/features/commerce/types";
import ManagementTable from "./components/management-table";
import type { Lookups } from "./components/record-form";
import {
  inventoryResources,
  resourcePermissions,
  titles,
  type Resource,
} from "./config";
function normalize(rows: Record<string, JsonValue>[]): DataRecord[] {
  return rows.map((row) => ({ id: String(row.id), data: row }));
}
export default async function ManagementPage({
  resource,
  searchParams,
}: {
  resource: string;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (!Object.hasOwn(titles, resource)) notFound();
  const selected = resource as Resource;
  const user = await requireManagement(resourcePermissions[selected]);
  const params = await searchParams;
  const q = params.q ?? "";
  const page = Math.max(1, Number(params.page) || 1);
  const lookups: Lookups = {
    warehouses: [],
    variants: [],
    stock: [],
    categories: [],
    collections: [],
  };
  let rows: DataRecord[];
  let total: number;
  if (inventoryResources.has(selected)) {
    const raw = await serverRequest<Record<string, JsonValue>[]>(
      `inventory/${selected}`,
      true,
    );
    let all = normalize(raw);
    if (q)
      all = all.filter((r) =>
        JSON.stringify(r.data).toLowerCase().includes(q.toLowerCase()),
      );
    if (params.warehouse)
      all = all.filter((r) => r.data.warehouse_id === params.warehouse);
    total = all.length;
    rows = all.slice((page - 1) * 30, page * 30);
    const [warehouses, stock, variants] = await Promise.all([
      serverRequest<Record<string, JsonValue>[]>("inventory/warehouses", true),
      ["stock", "reservations", "replenishments"].includes(selected)
        ? serverRequest<Record<string, JsonValue>[]>("inventory/stock", true)
        : Promise.resolve([]),
      selected === "stock"
        ? serverRequest<DataRecord[]>("inventory/variants", true)
        : Promise.resolve([]),
    ]);
    lookups.warehouses = normalize(warehouses);
    lookups.stock = normalize(stock);
    lookups.variants = variants;
  } else {
    const result = await serverRequest<RecordPage>(
      `admin/${selected}?page=${page}&q=${encodeURIComponent(q)}`,
      true,
    );
    rows = result.items;
    total = result.total;
    if (["products", "categories", "collections"].includes(selected)) {
      const [categories, collections] = await Promise.all([
        serverRequest<Taxonomy[]>("catalog/categories"),
        serverRequest<Taxonomy[]>("catalog/collections"),
      ]);
      lookups.categories = categories.map((c) => ({
        id: c.id,
        data: { name: c.name },
      }));
      lookups.collections = collections.map((c) => ({
        id: c.id,
        data: { name: c.name },
      }));
    }
  }
  const canManage =
    user.role === "admin" ||
    (inventoryResources.has(selected)
      ? user.permissions.includes("inventory.manage")
      : selected === "customers"
        ? false
        : true);
  return (
    <ManagementTable
      resource={selected}
      rows={rows}
      total={total}
      page={page}
      q={q}
      lookups={lookups}
      canManage={canManage}
      warehouse={params.warehouse}
    />
  );
}
