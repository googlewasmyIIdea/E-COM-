"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DataRecord } from "@/features/commerce/types";
import { request } from "@/features/commerce/client";
import ProductImage from "./product-image";
import EmptyState from "@/components/ui/empty-state";
import { message } from "@/lib/utils";
export default function Wishlist({ items }: { items: DataRecord[] }) {
  const [error, setError] = useState("");
  const router = useRouter();
  async function remove(id: string) {
    try {
      await request(`account/wishlist/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (f) {
      setError(message(f));
    }
  }
  return (
    <section>
      <h2 className="mb-7 font-serif text-3xl">Saved for a lovely day.</h2>
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {items.length ? (
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {items.map((item) => (
            <article key={item.id}>
              <Link
                href={`/products/${String(item.data.slug)}`}
                className="relative mb-4 block aspect-square overflow-hidden rounded-2xl"
              >
                <ProductImage
                  src={String(item.data.image)}
                  alt={String(item.data.name)}
                />
              </Link>
              <Link
                href={`/products/${String(item.data.slug)}`}
                className="text-sm font-medium"
              >
                {String(item.data.name)}
              </Link>
              <button
                onClick={() => remove(String(item.data.product_id))}
                className="mt-3 block text-xs text-ink/70 underline"
              >
                Remove from wishlist
              </button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Keep a little lovely for later"
          description="Tap the heart on a product to save it here."
          href="/shop"
        />
      )}
    </section>
  );
}
