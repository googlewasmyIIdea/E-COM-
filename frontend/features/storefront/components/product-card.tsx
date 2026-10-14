import Link from "next/link";
import { Star } from "lucide-react";
import ProductImage from "./product-image";
import ProductActions from "./product-actions";
import type { Product } from "@/features/commerce/types";
import { money } from "@/lib/utils";
export default function ProductCard({ product }: { product: Product }) {
  const variant =
    product.variants.find((v) => v.active && v.available_stock > 0) ??
    product.variants.find((v) => v.active);
  const sale =
    variant?.compare_at_price &&
    Number(variant.compare_at_price) > Number(variant.price);
  return (
    <article className="group min-w-0 rounded-xl border border-ink/10 bg-white p-2.5 shadow-sm sm:p-3">
      <Link
        href={`/products/${product.slug}`}
        className="relative mb-2 block aspect-square overflow-hidden rounded-lg bg-mint/20"
      >
        <ProductImage
          src={product.images[0] ?? "/images/stationery-hero.webp"}
          alt={product.name}
          className="transition duration-500 group-hover:scale-105"
        />
        {sale && (
          <span className="absolute left-3 top-3 rounded-full bg-coral-ink px-3 py-1 text-xs font-semibold text-white">
            On sale
          </span>
        )}
        {product.preorder && (
          <span className="absolute bottom-3 left-3 rounded-full bg-white px-3 py-1 text-xs">
            Preorder
          </span>
        )}
      </Link>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/70">
        {product.category_name}
      </p>
      <Link
        href={`/products/${product.slug}`}
        className="line-clamp-2 min-h-10 text-xs font-medium leading-5 hover:text-forest sm:text-sm"
      >
        {product.name}
      </Link>
      <div className="my-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-forest sm:text-sm">
          {variant ? money(variant.price) : "Unavailable"}
          {sale && (
            <span className="ml-2 text-xs font-normal text-ink/70 line-through">
              {money(variant!.compare_at_price!)}
            </span>
          )}
        </p>
        {product.rating && (
          <span className="flex items-center gap-1 text-xs">
            <Star size={12} fill="currentColor" className="text-coral-ink" />
            {product.rating} ({product.review_count})
          </span>
        )}
      </div>
      <ProductActions product={product} compact />
    </article>
  );
}
