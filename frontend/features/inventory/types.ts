export type BookFormat = "hardcover" | "paperback" | "ebook" | "audiobook";
export interface Warehouse {
  id: string;
  name: string;
  code: string;
  location: string;
  address: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}
export interface Stock {
  id: string;
  warehouse_id: string;
  variant_id: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  available_stock: number;
  reorder_point: number;
  product_name: string;
  variant_name: string;
  sku: string;
  warehouse_name: string;
  title_id?: string | null;
  format?: BookFormat | null;
}
export interface ReservationCreate {
  stock_id: string;
  quantity: number;
  cart_id?: string | null;
}
export interface Reservation extends ReservationCreate {
  id: string;
  variant_id: string;
  user_id: string;
  order_id: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  product_name: string;
  sku: string;
}
export interface Alert {
  id: string;
  stock_id: string;
  message: string;
  status: string;
  product_name: string;
  sku: string;
  warehouse_name: string;
  available_stock: number;
  reorder_point: number;
  updated_at: string;
}
export interface Replenishment {
  id: string;
  stock_id: string;
  quantity: number;
  received_quantity: number;
  kind: "backorder" | "preorder";
  status: string;
  expected_at: string | null;
  supplier: string;
  product_name: string;
  sku: string;
  warehouse_name: string;
  created_at: string;
}
export interface ErrorResponse {
  detail: string;
}
