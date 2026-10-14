import Link from "next/link";
import type { ReactNode } from "react";
import { requireCustomer } from "@/features/commerce/server";
import LogoutButton from "@/features/auth/components/logout-button";
export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireCustomer();
  return (
    <main className="page-width py-12">
      <header className="mb-9 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-3 text-coral-ink">Your little corner</p>
          <h1 className="font-serif text-4xl">
            Hello, {user.name || "lovely"}.
          </h1>
          <p className="mt-3 text-sm text-ink/70">{user.email}</p>
        </div>
        <LogoutButton />
      </header>
      <nav
        aria-label="Account navigation"
        className="mb-10 flex flex-wrap gap-2 border-b border-ink/10 pb-5"
      >
        {[
          ["/account", "Overview"],
          ["/account/orders", "Orders"],
          ["/account/addresses", "Addresses"],
          ["/account/wishlist", "Wishlist"],
          ["/account/settings", "Settings"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm hover:bg-lavender/40"
          >
            {label}
          </Link>
        ))}
        {user.role !== "customer" && (
          <Link
            href="/admin"
            className="rounded-full bg-ink px-4 py-2 text-sm text-white"
          >
            Staff workspace
          </Link>
        )}
      </nav>
      {children}
    </main>
  );
}
