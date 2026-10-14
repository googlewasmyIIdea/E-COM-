import { apiRequest } from "@/lib/api";
import { inventoryRoutes } from "./routes";
import type {
  Alert,
  Replenishment,
  Reservation,
  ReservationCreate,
  Stock,
  Warehouse,
} from "./types";

export const inventoryApi = {
  warehouses: () => apiRequest<Warehouse[]>(inventoryRoutes.warehouses),
  stock: () => apiRequest<Stock[]>(inventoryRoutes.stock),
  reservations: () => apiRequest<Reservation[]>(inventoryRoutes.reservations),
  alerts: () => apiRequest<Alert[]>(inventoryRoutes.alerts),
  replenishments: () =>
    apiRequest<Replenishment[]>(inventoryRoutes.replenishments),
  createReservation: (payload: ReservationCreate) =>
    apiRequest<Reservation>(inventoryRoutes.reservations, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
