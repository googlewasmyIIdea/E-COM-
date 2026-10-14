"use client";
import { useState } from "react";
import { Heart, Minus, Plus, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import { request, ApiError, cartChanged } from "@/features/commerce/client";
import type { Product } from "@/features/commerce/types";
import { message, money } from "@/lib/utils";

export default function ProductActions({
  product,
  compact = false,
}: {
  product: Product;
  compact?: boolean;
}) {
  const variants = product.variants.filter((v) => v.active);
  const [selected, setSelected] = useState(
    variants.find((v) => v.available_stock > 0)?.id ?? variants[0]?.id ?? "",
  );
  const variant = variants.find((v) => v.id === selected);
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const router = useRouter();
  const available =
    !!variant &&
    (variant.available_stock > 0 ||
      product.allow_backorder ||
      product.preorder);
  async function add() {
    if (!variant) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      await request("cart/items", {
        method: "POST",
        body: { variant_id: variant.id, quantity },
      });
      cartChanged();
      setNotice("Added to your cart");
    } catch (failure) {
      setError(message(failure));
    } finally {
      setPending(false);
    }
  }
  async function wish() {
    setError("");
    try {
      await request(`account/wishlist/${product.id}`, { method: "POST" });
      setNotice("Saved to your wishlist");
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401)
        router.push("/login");
      else setError(message(failure));
    }
  }
  return (
    <div className={compact ? "space-y-2" : "space-y-6"}>
      {!compact && (
        <>
          <p className="text-3xl font-semibold">
            {variant ? money(variant.price) : "Unavailable"}
            {variant?.compare_at_price && (
              <span className="ml-3 text-lg font-normal text-ink/70 line-through">
                {money(variant.compare_at_price)}
              </span>
            )}
          </p>
          <div>
            <p className="mb-3 text-sm font-semibold">Choose your variant</p>
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setSelected(v.id);
                    setQuantity(1);
                  }}
                  aria-pressed={selected === v.id}
                  className={`rounded-full border px-5 py-2.5 text-sm ${selected === v.id ? "border-ink bg-lavender/60" : "border-ink/15 bg-white"}`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>
          <p className="text-sm text-ink/70">
            {variant && variant.available_stock > 0
              ? `${variant.available_stock} available`
              : product.preorder
                ? "Available for preorder"
                : product.allow_backorder
                  ? "Available on backorder"
                  : "Currently out of stock"}
          </p>
          <div className="inline-flex items-center gap-5 rounded-full border border-ink/15 bg-white p-1">
            <button
              aria-label="Decrease quantity"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity === 1}
              className="rounded-full p-3 disabled:opacity-30"
            >
              <Minus size={16} />
            </button>
            <span aria-label="Quantity">{quantity}</span>
            <button
              aria-label="Increase quantity"
              onClick={() => setQuantity(Math.min(99, quantity + 1))}
              disabled={
                quantity >=
                (product.allow_backorder || product.preorder
                  ? 99
                  : (variant?.available_stock ?? 0))
              }
              className="rounded-full p-3 disabled:opacity-30"
            >
              <Plus size={16} />
            </button>
          </div>
        </>
      )}
      <div className="flex gap-2">
        <Button
          onClick={add}
          disabled={pending || !available}
          className={
            compact
              ? "min-w-0 flex-1 gap-1 rounded-lg bg-forest px-1.5 py-2 text-[11px] hover:bg-forest/90 sm:text-xs"
              : "flex-1"
          }
          aria-label={compact ? `Add ${product.name} to cart` : undefined}
        >
          <ShoppingBag
            size={16}
            aria-hidden="true"
            className={compact ? "hidden sm:block" : ""}
          />
          {pending ? "Adding…" : available ? "Add to cart" : "Out of stock"}
        </Button>
        <Button
          onClick={wish}
          variant="secondary"
          aria-label={`Save ${product.name} to wishlist`}
          className={compact ? "size-11 shrink-0 rounded-lg px-0" : "px-3"}
        >
          <Heart size={17} aria-hidden="true" />
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-800">
          {notice}
        </p>
      )}
    </div>
  );
}
