import Link from "next/link";
import { Search, SlidersHorizontal, ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { serverRequest } from "@/features/commerce/server";
import type { ProductPage, Taxonomy } from "@/features/commerce/types";
import ProductCard from "@/features/storefront/components/product-card";
import EmptyState from "@/components/ui/empty-state";
import { Input, Field } from "@/components/ui/input";
import Button from "@/components/ui/button";
export const metadata: Metadata = {
  title: "Shop stationery",
  alternates: { canonical: "/shop" },
};
export default async function Shop({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw))
    if (typeof value === "string" && value.trim() !== "")
      params.set(key, value);
  const [products, categories] = await Promise.all([
    serverRequest<ProductPage>(`catalog/products?${params}`),
    serverRequest<Taxonomy[]>("catalog/categories"),
  ]);
  const category = categories.find((c) => c.slug === params.get("category"));
  const page = products.page;
  const pages = Math.ceil(products.total / products.page_size);
  function pageLink(number: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(number));
    return `/shop?${next}`;
  }
  return (
    <main className="page-width py-10 sm:py-14">
      <p className="eyebrow mb-4 text-coral-ink">
        Thoughtful things, endless possibilities
      </p>
      <h1 className="font-serif text-4xl sm:text-5xl">
        {category?.name ?? "All the lovely things."}
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-ink/70">
        Find your next favourite pen, a fresh page for your ideas, or the
        perfect little gift.
      </p>
      <form action="/shop" className="mt-8 flex gap-3" id="shop-search">
        <label htmlFor="catalog-search" className="sr-only">
          Search products
        </label>
        <div className="relative max-w-xl flex-1">
          <Search size={17} className="absolute left-4 top-3.5 text-ink/70" />
          <Input
            id="catalog-search"
            name="q"
            defaultValue={params.get("q") ?? ""}
            placeholder="Search notebooks, pens, and little joys…"
            className="pl-11"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>
      <div className="mt-9 grid gap-8 lg:grid-cols-[210px_1fr]">
        <aside>
          <details
            open
            className="rounded-2xl border border-ink/10 bg-white/50 p-5"
          >
            <summary className="mb-5 flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal size={16} />
              Find your perfect match
            </summary>
            <form action="/shop" className="space-y-5">
              <input type="hidden" name="q" value={params.get("q") ?? ""} />
              <Field htmlFor="filter-category" label="Category">
                <select
                  id="filter-category"
                  name="category"
                  defaultValue={params.get("category") ?? ""}
                  className="select-field"
                >
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field htmlFor="filter-brand" label="Brand">
                <Input
                  id="filter-brand"
                  name="brand"
                  defaultValue={params.get("brand") ?? ""}
                  placeholder="Brand name"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field htmlFor="minimum-price" label="Min NPR">
                  <Input
                    id="minimum-price"
                    name="min_price"
                    type="number"
                    min="0"
                    defaultValue={params.get("min_price") ?? ""}
                  />
                </Field>
                <Field htmlFor="maximum-price" label="Max NPR">
                  <Input
                    id="maximum-price"
                    name="max_price"
                    type="number"
                    min="0"
                    defaultValue={params.get("max_price") ?? ""}
                  />
                </Field>
              </div>
              <Field htmlFor="filter-color" label="Color">
                <select
                  id="filter-color"
                  name="color"
                  defaultValue={params.get("color") ?? ""}
                  className="select-field"
                >
                  <option value="">All colors</option>
                  <option>Lavender</option>
                  <option>Mint</option>
                  <option>Cream</option>
                  <option>Peach</option>
                  <option>Black</option>
                </select>
              </Field>
              <Field htmlFor="filter-availability" label="Availability">
                <select
                  id="filter-availability"
                  name="availability"
                  defaultValue={params.get("availability") ?? ""}
                  className="select-field"
                >
                  <option value="">All products</option>
                  <option value="in_stock">In stock</option>
                  <option value="out_of_stock">Out of stock</option>
                </select>
              </Field>
              <Field htmlFor="filter-attribute" label="Product specification">
                <Input
                  id="filter-attribute"
                  name="attribute"
                  defaultValue={params.get("attribute") ?? ""}
                  placeholder="paper_size:A5"
                  aria-describedby="attribute-help"
                />
                <p id="attribute-help" className="mt-2 text-xs text-ink/70">
                  Use a specification and value from product details, such as
                  paper_size:A5.
                </p>
              </Field>
              <Field htmlFor="filter-sort" label="Sort by">
                <select
                  id="filter-sort"
                  name="sort"
                  defaultValue={params.get("sort") ?? "newest"}
                  className="select-field"
                >
                  <option value="newest">Newest first</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                  <option value="name">Name</option>
                  <option value="bestsellers">Best sellers</option>
                </select>
              </Field>
              <Button type="submit" className="w-full">
                Apply filters
              </Button>
              <Link
                href="/shop"
                className="block text-center text-xs underline"
              >
                Clear filters
              </Link>
            </form>
          </details>
        </aside>
        <section aria-label="Products">
          <div className="mb-6 flex items-center justify-between text-sm">
            <p>
              {products.total}{" "}
              {products.total === 1 ? "lovely find" : "lovely finds"}
              {params.get("q") ? ` for “${params.get("q")}”` : ""}
            </p>
            <p className="text-xs text-ink/70">Prices in NPR</p>
          </div>
          {products.items.length ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 xl:grid-cols-3 xl:gap-6">
              {products.items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No finds just yet"
              description="Try another search or clear a filter. Your next favourite might be one click away."
              href="/shop"
              action="Browse all products"
            />
          )}
          {pages > 1 && (
            <nav
              aria-label="Product pages"
              className="mt-10 flex items-center justify-center gap-5"
            >
              {page > 1 && (
                <Link
                  href={pageLink(page - 1)}
                  className="icon-button"
                  aria-label="Previous page"
                >
                  <ArrowLeft size={18} />
                </Link>
              )}
              <span className="text-sm">
                Page {page} of {pages}
              </span>
              {page < pages && (
                <Link
                  href={pageLink(page + 1)}
                  className="icon-button"
                  aria-label="Next page"
                >
                  <ArrowRight size={18} />
                </Link>
              )}
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}
