"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Flower2, Heart, Menu, ShoppingBag, UserRound } from "lucide-react";
import type { Cart, Taxonomy } from "@/features/commerce/types";
import { request } from "@/features/commerce/client";
import Modal from "@/components/ui/modal";
import SearchBar from "./search-bar";
import AnnouncementBar from "./announcement-bar";
export default function StoreHeader({
  categories,
  announcement,
}: {
  categories: Taxonomy[];
  announcement: string;
}) {
  const [count, setCount] = useState<number | null>(null);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      request<Cart>("cart")
        .then((cart) => {
          if (active) setCount(cart.count);
        })
        .catch(() => {});
    refresh();
    window.addEventListener("cart-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("cart-changed", refresh);
    };
  }, []);
  return (
    <>
      <AnnouncementBar text={announcement} />
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-ivory/95 backdrop-blur-md">
        <div className="page-width flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-1.5 sm:py-3">
          <Link
            href="/"
            aria-label="Paper and Petal home"
            className="flex shrink-0 items-center gap-2"
          >
            <Flower2
              size={26}
              strokeWidth={1.4}
              className="text-forest"
              aria-hidden="true"
            />
            <span className="font-serif text-xl tracking-tight sm:text-2xl">
              paper <span className="italic">&</span> petal
              <span className="hidden pt-0.5 text-center font-sans text-[8px] uppercase tracking-[0.23em] sm:block">
                little things. lovely days.
              </span>
            </span>
          </Link>
          <div className="order-3 w-full lg:order-none lg:w-auto lg:flex-1 lg:px-5">
            <SearchBar />
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link
              href="/login"
              className="hidden min-h-11 items-center px-2 text-sm font-medium hover:text-forest sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/account/wishlist"
              aria-label="Wishlist"
              className="icon-button hidden sm:inline-flex"
            >
              <Heart size={19} />
            </Link>
            <Link
              href="/account"
              aria-label="Your account"
              className="icon-button"
            >
              <UserRound size={19} />
            </Link>
            <Link
              href="/cart"
              aria-label={`Shopping cart${count !== null ? `, ${count} items` : ""}`}
              className="icon-button relative"
            >
              <ShoppingBag size={20} />
              {count !== null && count > 0 && (
                <span className="absolute right-0 top-0 flex min-w-4 items-center justify-center rounded-full bg-forest px-1 text-[10px] text-white">
                  {count}
                </span>
              )}
            </Link>
            <button
              aria-label="Open menu"
              onClick={() => setMobile(true)}
              className="icon-button sm:hidden"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
        <nav
          aria-label="Shop categories"
          className="page-width flex items-center gap-5 overflow-x-auto whitespace-nowrap pb-2 text-xs sm:gap-6 sm:text-sm"
        >
          <Link
            href="/shop"
            className="flex min-h-11 shrink-0 items-center font-semibold text-forest"
          >
            Shop
          </Link>
          <Link
            href="/shop?sort=newest"
            className="flex min-h-11 shrink-0 items-center"
          >
            New arrivals
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/shop?category=${category.slug}`}
              className="flex min-h-11 shrink-0 items-center hover:text-forest"
            >
              {category.name}
            </Link>
          ))}
        </nav>
      </header>
      <Modal
        title="Explore Paper & Petal"
        open={mobile}
        onClose={() => setMobile(false)}
      >
        <nav aria-label="Mobile navigation" className="grid gap-2">
          {[
            { href: "/login", name: "Sign in" },
            { href: "/shop", name: "Shop all" },
            { href: "/account", name: "Account" },
            { href: "/account/wishlist", name: "Wishlist" },
            ...categories.map((c) => ({
              href: `/shop?category=${c.slug}`,
              name: c.name,
            })),
          ].map((link) => (
            <Link
              key={link.href}
              onClick={() => setMobile(false)}
              href={link.href}
              className="rounded-lg p-3 hover:bg-mint/50"
            >
              {link.name}
            </Link>
          ))}
        </nav>
      </Modal>
    </>
  );
}
