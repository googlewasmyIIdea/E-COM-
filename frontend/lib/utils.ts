import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
export function money(value: string | number): string {
  return new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    maximumFractionDigits: 2,
  }).format(Number(value));
}
export function humanize(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}
export function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to complete this request.";
}

export function managementLanding(user: {
  role: string;
  permissions: string[];
}): string {
  if (user.role === "customer") return "/account";
  if (user.role === "admin" || user.permissions.includes("dashboard.view"))
    return "/admin";
  if (
    user.permissions.includes("inventory.view") ||
    user.permissions.includes("inventory.manage")
  )
    return "/inventory";
  const routes: Record<string, string> = {
    "catalog.manage": "/admin/products",
    "orders.manage": "/admin/orders",
    "customers.manage": "/admin/customers",
    "marketing.manage": "/admin/promotions",
    "reviews.manage": "/admin/reviews",
    "payments.view": "/admin/payments",
    "settings.manage": "/admin/settings",
    "notifications.view": "/admin/notifications",
    "audit.view": "/admin/audit",
  };
  return user.permissions.map((p) => routes[p]).find(Boolean) ?? "/account";
}
