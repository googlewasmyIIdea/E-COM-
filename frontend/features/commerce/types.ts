export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type Money = string;
export interface Variant {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  price: Money;
  compare_at_price: Money | null;
  attributes: Record<string, JsonValue>;
  image: string | null;
  active: boolean;
  available_stock: number;
}
export interface Review {
  id: string;
  product_id: string;
  rating: number;
  title: string;
  body: string;
  status: string;
  verified_purchase: boolean;
  created_at: string;
  author: string;
}
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  category_id: string | null;
  category_name: string;
  brand: string;
  images: string[];
  attributes: Record<string, JsonValue>;
  active: boolean;
  featured: boolean;
  allow_backorder: boolean;
  preorder: boolean;
  release_date: string | null;
  created_at: string;
  variants: Variant[];
  available_stock: number;
  rating: Money | null;
  review_count: number;
  reviews: Review[];
  collection_ids: string[];
}
export interface ProductPage {
  items: Product[];
  total: number;
  page: number;
  page_size: number;
}
export interface Taxonomy {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  active: boolean;
  parent_id: string | null;
}
export interface DataRecord {
  id: string;
  data: Record<string, JsonValue>;
}
export interface RecordPage {
  items: DataRecord[];
  total: number;
}
export interface CartItem {
  id: string;
  variant_id: string;
  product_id: string;
  name: string;
  slug: string;
  variant_name: string;
  sku: string;
  image: string;
  quantity: number;
  price: Money;
  total: Money;
  available_stock: number;
  allow_backorder: boolean;
}
export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: Money;
  count: number;
  currency: string;
}
export interface Address {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  postal_code?: string;
  country: string;
  is_default?: boolean;
}
export interface OrderItem {
  id: string;
  variant_id: string;
  product_name: string;
  variant_name: string;
  sku: string;
  image: string;
  quantity: number;
  allocated: number;
  unit_price: Money;
  total: Money;
}
export interface Order {
  id: string;
  number: string;
  user_id: string;
  status: string;
  payment_status: string;
  payment_method: string;
  subtotal: Money;
  discount: Money;
  shipping: Money;
  total: Money;
  currency: string;
  address: Record<string, JsonValue>;
  delivery: string;
  coupon_code: string | null;
  tracking_number: string | null;
  notes: string;
  created_at: string;
  items: OrderItem[];
}
export interface Overview {
  products: number;
  customers: number;
  orders: number;
  revenue: Money;
  low_stock: number;
  active_reservations: number;
  pending_orders: number;
  recent_orders: Order[];
  revenue_by_day: { date: string; revenue: Money }[];
}
export interface PaymentOptions {
  cod: boolean;
  esewa: boolean;
  khalti: boolean;
}
export interface PaymentInitiation {
  provider: string;
  payment_url: string | null;
  form_url: string | null;
  fields: Record<string, string>;
  reference: string;
}
export interface PaymentResult {
  order_id: string;
  status: string;
  verified: boolean;
}
export interface Quote {
  subtotal: Money;
  shipping: Money;
  discount: Money;
  total: Money;
  coupon_code: string | null;
}
