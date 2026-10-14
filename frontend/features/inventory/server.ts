import "server-only";
import { backendRequest, sessionToken } from "@/features/auth/server";
import { inventoryRoutes } from "./routes";
import type {
  Alert,
  Replenishment,
  Reservation,
  Stock,
  Warehouse,
} from "./types";

async function query<T>(path: string): Promise<T> {
  const token = await sessionToken();
  if (!token) throw new Error("Please sign in to continue.");
  const response = await backendRequest(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok)
    throw new Error(`Inventory request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export const inventoryQueries = {
  warehouses: () => query<Warehouse[]>(inventoryRoutes.warehouses),
  stock: () => query<Stock[]>(inventoryRoutes.stock),
  reservations: () => query<Reservation[]>(inventoryRoutes.reservations),
  alerts: () => query<Alert[]>(inventoryRoutes.alerts),
  replenishments: () => query<Replenishment[]>(inventoryRoutes.replenishments),
};
