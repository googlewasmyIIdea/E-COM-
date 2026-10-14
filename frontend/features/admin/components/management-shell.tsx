"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Flower2,
  LayoutDashboard,
  Package,
  Layers3,
  Warehouse,
  ShoppingBag,
  Users,
  CreditCard,
  Tag,
  MessageSquare,
  Settings,
  ChartNoAxesCombined,
  Menu,
  ArrowUpRight,
  Bell,
  ClipboardList,
  RotateCcw,
} from "lucide-react";
import type { User } from "@/features/auth/schemas";
import LogoutButton from "@/features/auth/components/logout-button";
import { cn } from "@/lib/utils";
export default function ManagementShell({
  user,
  children,
  inventory = false,
}: {
  user: User;
  children: ReactNode;
  inventory?: boolean;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const links = [
    {
      href: "/admin",
      name: "Overview",
      icon: LayoutDashboard,
      permission: "dashboard.view",
    },
    {
      href: "/admin/products",
      name: "Products",
      icon: Package,
      permission: "catalog.manage",
    },
    {
      href: "/admin/categories",
      name: "Categories",
      icon: Layers3,
      permission: "catalog.manage",
    },
    {
      href: "/admin/collections",
      name: "Collections",
      icon: Layers3,
      permission: "catalog.manage",
    },
    {
      href: "/inventory/warehouses",
      name: "Warehouses",
      icon: Warehouse,
      permission: "inventory.view",
    },
    {
      href: "/inventory/stock",
      name: "Stock",
      icon: Package,
      permission: "inventory.view",
    },
    {
      href: "/inventory/reservations",
      name: "Reservations",
      icon: ClipboardList,
      permission: "inventory.view",
    },
    {
      href: "/inventory/replenishments",
      name: "Replenishments",
      icon: RotateCcw,
      permission: "inventory.view",
    },
    {
      href: "/inventory/alerts",
      name: "Low-stock alerts",
      icon: Bell,
      permission: "inventory.view",
    },
    {
      href: "/inventory/movements",
      name: "Stock movements",
      icon: ClipboardList,
      permission: "inventory.view",
    },
    {
      href: "/admin/orders",
      name: "Orders",
      icon: ShoppingBag,
      permission: "orders.manage",
    },
    {
      href: "/admin/customers",
      name: "Customers",
      icon: Users,
      permission: "customers.manage",
    },
    {
      href: "/admin/payments",
      name: "Payments",
      icon: CreditCard,
      permission: "payments.view",
    },
    {
      href: "/admin/promotions",
      name: "Promotions",
      icon: Tag,
      permission: "marketing.manage",
    },
    {
      href: "/admin/coupons",
      name: "Coupons",
      icon: Tag,
      permission: "marketing.manage",
    },
    {
      href: "/admin/reviews",
      name: "Reviews",
      icon: MessageSquare,
      permission: "reviews.manage",
    },
    {
      href: "/admin/returns",
      name: "Returns",
      icon: RotateCcw,
      permission: "orders.manage",
    },
    {
      href: "/admin/analytics",
      name: "Analytics",
      icon: ChartNoAxesCombined,
      permission: "dashboard.view",
    },
    {
      href: "/admin/settings",
      name: "Store settings",
      icon: Settings,
      permission: "settings.manage",
    },
    {
      href: "/admin/newsletter",
      name: "Newsletter",
      icon: Users,
      permission: "marketing.manage",
    },
    {
      href: "/admin/notifications",
      name: "Notifications",
      icon: Bell,
      permission: "notifications.view",
    },
    {
      href: "/admin/audit",
      name: "Audit log",
      icon: ClipboardList,
      permission: "audit.view",
    },
  ];
  const visible = links.filter(
    (l) =>
      user.role === "admin" ||
      user.permissions.includes(l.permission) ||
      (l.permission === "inventory.view" &&
        user.permissions.includes("inventory.manage")),
  );
  return (
    <div className="min-h-screen bg-[#F4F4F8] text-ink">
      <div className="flex items-center justify-between border-b border-ink/10 bg-white px-5 py-4 lg:hidden">
        <Link href="/admin" className="font-serif text-xl">
          paper & petal
        </Link>
        <button
          onClick={() => setOpen(!open)}
          aria-label="Toggle management navigation"
          aria-expanded={open}
          className="icon-button"
        >
          <Menu size={20} />
        </button>
      </div>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-60 overflow-y-auto border-r border-ink/8 bg-white p-5 lg:block",
          open ? "block" : "hidden",
        )}
      >
        <Link
          href="/"
          className="mb-9 flex items-center gap-2 font-serif text-xl"
        >
          <Flower2 size={24} className="text-coral-ink" />
          paper & petal
        </Link>
        <p className="eyebrow mb-4 text-ink/70">Store workspace</p>
        <nav aria-label="Management navigation" className="space-y-1">
          {visible.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium",
                path === l.href
                  ? "bg-lavender/55 text-ink"
                  : "text-ink/70 hover:bg-ivory",
              )}
            >
              <l.icon size={16} />
              {l.name}
            </Link>
          ))}
        </nav>
        <Link
          href="/"
          className="mt-8 flex items-center justify-between rounded-xl border border-ink/10 px-3 py-3 text-xs"
        >
          View storefront
          <ArrowUpRight size={15} />
        </Link>
      </aside>
      {open && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-ink/25 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="lg:pl-60">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 bg-white px-6 py-4 sm:px-9">
          <div>
            <p className="text-xs font-semibold">
              {inventory
                ? "Inventory & warehouse operations"
                : "Administration"}
            </p>
            <p className="mt-1 text-[11px] text-ink/70">
              {user.name || user.email} · {user.role}
            </p>
          </div>
          <LogoutButton />
        </header>
        <main className="mx-auto max-w-[1500px] p-5 sm:p-8 lg:p-9">
          {children}
        </main>
      </div>
    </div>
  );
}
