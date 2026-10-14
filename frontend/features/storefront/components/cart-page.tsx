"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import type { Cart } from "@/features/commerce/types";
import { cartChanged, request } from "@/features/commerce/client";
import ProductImage from "./product-image";
import EmptyState from "@/components/ui/empty-state";
import { message, money } from "@/lib/utils";
export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  useEffect(() => {
    let active = true;
    request<Cart>("cart")
      .then((data) => {
        if (active) setCart(data);
      })
      .catch((failure) => {
        if (active) setError(message(failure));
      });
    return () => {
      active = false;
    };
  }, []);
  async function change(id: string, quantity?: number) {
    setPending(id);
    setError("");
    try {
      const result = await request<Cart>(`cart/items/${id}`, {
        method: quantity ? "PATCH" : "DELETE",
        body: quantity ? { quantity } : undefined,
      });
      setCart(result);
      cartChanged();
    } catch (failure) {
      setError(message(failure));
    } finally {
      setPending("");
    }
  }
  return (
    <main className="page-width py-12">
      <p className="eyebrow mb-4 text-coral-ink">Your lovely little finds</p>
      <h1 className="font-serif text-4xl sm:text-5xl">Your shopping bag.</h1>
      {error && (
        <p
          role="alert"
          className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {!cart && !error && (
        <div
          className="mt-8 h-60 animate-pulse rounded-2xl bg-lavender/25"
          aria-label="Loading your cart"
        />
      )}
      {cart && !cart.items.length && (
        <div className="mt-8">
          <EmptyState
            title="A little room for something lovely"
            description="Your bag is empty. Find a fresh notebook, your next favourite pen, or a thoughtful gift."
            href="/shop"
          />
        </div>
      )}
      {!!cart?.items.length && (
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_350px]">
          <section className="space-y-5">
            {cart.items.map((item) => (
              <article
                key={item.id}
                className="flex gap-4 rounded-2xl border border-ink/10 bg-white/65 p-4 sm:gap-6 sm:p-5"
              >
                <Link
                  href={`/products/${item.slug}`}
                  className="relative size-24 shrink-0 overflow-hidden rounded-xl sm:size-32"
                >
                  <ProductImage
                    src={item.image}
                    alt={item.name}
                    sizes="130px"
                  />
                </Link>
                <div className="flex flex-1 flex-col justify-between gap-3">
                  <div className="flex justify-between gap-2">
                    <div>
                      <Link
                        href={`/products/${item.slug}`}
                        className="font-medium"
                      >
                        {item.name}
                      </Link>
                      <p className="mt-1 text-xs text-ink/70">
                        {item.variant_name}
                      </p>
                      <p className="mt-2 text-sm">{money(item.price)}</p>
                    </div>
                    <button
                      aria-label={`Remove ${item.name}`}
                      disabled={pending === item.id}
                      onClick={() => change(item.id)}
                      className="icon-button text-ink/70"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 rounded-full border border-ink/15">
                      <button
                        aria-label={`Decrease ${item.name} quantity`}
                        disabled={item.quantity === 1 || pending === item.id}
                        onClick={() => change(item.id, item.quantity - 1)}
                        className="icon-button disabled:opacity-30"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-sm">{item.quantity}</span>
                      <button
                        aria-label={`Increase ${item.name} quantity`}
                        disabled={pending === item.id || item.quantity >= 99}
                        onClick={() => change(item.id, item.quantity + 1)}
                        className="icon-button"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <p className="text-sm font-semibold">{money(item.total)}</p>
                  </div>
                </div>
              </article>
            ))}
          </section>
          <aside className="h-fit rounded-2xl border border-ink/10 bg-white p-7">
            <h2 className="font-serif text-2xl">A little summary</h2>
            <div className="mt-7 flex justify-between text-sm">
              <span>Subtotal ({cart.count} items)</span>
              <span className="font-semibold">{money(cart.subtotal)}</span>
            </div>
            <p className="mt-4 text-xs leading-6 text-ink/70">
              Delivery and discounts are calculated by the store at checkout.
            </p>
            <Link
              href="/checkout"
              className="mt-7 flex items-center justify-center gap-3 rounded-full bg-ink px-5 py-3.5 text-sm font-semibold text-white"
            >
              Continue to checkout <ArrowRight size={16} />
            </Link>
            <Link
              href="/shop"
              className="mt-5 flex items-center justify-center gap-2 text-xs underline"
            >
              <ShoppingBag size={13} />
              Keep exploring
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}
