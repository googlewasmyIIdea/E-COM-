export type Resource =
  | "products"
  | "categories"
  | "collections"
  | "warehouses"
  | "stock"
  | "reservations"
  | "replenishments"
  | "alerts"
  | "movements"
  | "orders"
  | "customers"
  | "payments"
  | "promotions"
  | "coupons"
  | "reviews"
  | "returns"
  | "settings"
  | "newsletter"
  | "notifications"
  | "audit";
export const titles: Record<Resource, string> = {
  products: "Products",
  categories: "Categories",
  collections: "Collections",
  warehouses: "Warehouses",
  stock: "Stock",
  reservations: "Reservations",
  replenishments: "Replenishments",
  alerts: "Low-stock alerts",
  movements: "Stock movements",
  orders: "Orders",
  customers: "Customers",
  payments: "Payments",
  promotions: "Promotions",
  coupons: "Coupons",
  reviews: "Reviews",
  returns: "Returns",
  settings: "Store settings",
  newsletter: "Newsletter",
  notifications: "Notifications",
  audit: "Audit log",
};
export const inventoryResources = new Set<Resource>([
  "warehouses",
  "stock",
  "reservations",
  "replenishments",
  "alerts",
  "movements",
]);
export const resourcePermissions: Record<Resource, string> = {
  products: "catalog.manage",
  categories: "catalog.manage",
  collections: "catalog.manage",
  warehouses: "inventory.view",
  stock: "inventory.view",
  reservations: "inventory.view",
  replenishments: "inventory.view",
  alerts: "inventory.view",
  movements: "inventory.view",
  orders: "orders.manage",
  customers: "customers.manage",
  payments: "payments.view",
  promotions: "marketing.manage",
  coupons: "marketing.manage",
  reviews: "reviews.manage",
  returns: "orders.manage",
  settings: "settings.manage",
  newsletter: "marketing.manage",
  notifications: "notifications.view",
  audit: "audit.view",
};
export const columns: Record<Resource, string[]> = {
  products: ["name", "brand", "active", "featured"],
  categories: ["name", "slug", "active"],
  collections: ["name", "slug", "active"],
  warehouses: ["name", "code", "location", "active"],
  stock: [
    "product_name",
    "sku",
    "warehouse_name",
    "quantity_on_hand",
    "quantity_reserved",
    "available_stock",
    "reorder_point",
  ],
  reservations: ["product_name", "sku", "quantity", "status", "expires_at"],
  replenishments: [
    "product_name",
    "sku",
    "warehouse_name",
    "quantity",
    "received_quantity",
    "status",
  ],
  alerts: [
    "product_name",
    "sku",
    "warehouse_name",
    "available_stock",
    "reorder_point",
    "status",
  ],
  movements: ["kind", "delta", "reason", "created_at"],
  orders: ["number", "status", "payment_status", "total", "created_at"],
  customers: ["name", "email", "role", "is_active"],
  payments: ["provider", "amount", "status", "verified_at"],
  promotions: ["name", "headline", "active"],
  coupons: ["code", "kind", "value", "uses", "max_uses", "active"],
  reviews: ["title", "rating", "status", "verified_purchase", "reports"],
  returns: ["reason", "status", "created_at"],
  settings: ["key", "value", "public"],
  newsletter: ["email", "consent", "active"],
  notifications: ["recipient", "subject", "status", "attempts"],
  audit: ["action", "resource", "resource_id", "created_at"],
};
export const readOnly = new Set<Resource>([
  "payments",
  "movements",
  "newsletter",
  "notifications",
  "audit",
]);
export const creatable = new Set<Resource>([
  "products",
  "categories",
  "collections",
  "warehouses",
  "stock",
  "reservations",
  "replenishments",
  "promotions",
  "coupons",
  "settings",
]);
