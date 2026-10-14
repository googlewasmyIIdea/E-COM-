import Link from "next/link";
import { ArrowRight, PackageCheck, Truck } from "lucide-react";
import StoreShell from "./shell";
import ProductGrid from "./components/product-grid";
import ProductImage from "./components/product-image";
import HeroBanner from "./components/hero-banner";
import NewsletterForm from "./components/newsletter-form";
import EmptyState from "@/components/ui/empty-state";
import { serverRequest } from "@/features/commerce/server";
import type {
  DataRecord,
  ProductPage,
  Taxonomy,
  Review,
} from "@/features/commerce/types";
function ProductSection({
  title,
  subtitle,
  products,
  href,
}: {
  title: string;
  subtitle: string;
  products: ProductPage;
  href: string;
}) {
  if (!products.items.length) return null;
  return (
    <section className="page-width py-6" aria-label={title}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl">{title}</h2>
          <p className="mt-1 hidden text-sm text-ink/70 sm:block">{subtitle}</p>
        </div>
        <Link
          href={href}
          className="flex min-h-11 shrink-0 items-center gap-2 text-xs font-semibold text-forest sm:text-sm"
        >
          See all <ArrowRight size={15} />
        </Link>
      </div>
      <ProductGrid products={products.items} />
    </section>
  );
}
export default async function HomeContent() {
  const empty: ProductPage = { items: [], total: 0, page: 1, page_size: 12 };
  const [
    categories,
    catalog,
    newest,
    bestsellers,
    collections,
    promotions,
    reviews,
  ] = await Promise.all([
    serverRequest<Taxonomy[]>("catalog/categories").catch(() => []),
    serverRequest<ProductPage>(
      "catalog/products?sort=featured&availability=in_stock&page_size=12",
    ).catch(() => null),
    serverRequest<ProductPage>(
      "catalog/products?sort=newest&page_size=12",
    ).catch(() => empty),
    serverRequest<ProductPage>(
      "catalog/products?sort=bestsellers&page_size=12",
    ).catch(() => empty),
    serverRequest<Taxonomy[]>("catalog/collections").catch(() => []),
    serverRequest<DataRecord[]>("store/promotions").catch(() => []),
    serverRequest<Review[]>("store/reviews").catch(() => []),
  ]);
  return (
    <StoreShell>
      <main>
        <div className="page-width pt-4">
          <HeroBanner />
        </div>
        {catalog?.items.length ? (
          <ProductSection
            title="Shop stationery"
            subtitle="Available now. Little essentials for your desk, ideas, and everyday."
            products={catalog}
            href="/shop"
          />
        ) : (
          <section className="page-width py-6" aria-label="Shop stationery">
            <EmptyState
              title={
                catalog === null
                  ? "The shop is taking a little pause"
                  : "New lovely things are on their way"
              }
              description={
                catalog === null
                  ? "We’re having trouble loading products. Please refresh in a moment."
                  : "Browse the full catalog for upcoming releases and backorders."
              }
              href="/shop"
              action="Browse the shop"
            />
          </section>
        )}
        <div className="page-width my-3 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 rounded-xl bg-mint/40 px-4 py-3 text-xs">
          <span className="flex items-center gap-2">
            <PackageCheck size={16} /> Cash on Delivery
          </span>
          <Link href="/shipping" className="flex min-h-11 items-center gap-2">
            <Truck size={16} /> Delivery options
          </Link>
          <Link href="/returns" className="flex min-h-11 items-center">
            Returns & support
          </Link>
        </div>
        {!!categories.length && (
          <section aria-label="Discover categories" className="page-width py-6">
            <h2 className="mb-4 font-serif text-2xl">
              Find your kind of lovely.
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-3">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/shop?category=${c.slug}`}
                  className="w-24 shrink-0 text-center sm:w-28"
                >
                  <div className="relative mx-auto mb-2 size-16 overflow-hidden rounded-full bg-mint/40 sm:size-20">
                    <ProductImage src={c.image} alt={c.name} sizes="80px" />
                  </div>
                  <span className="text-[11px] font-medium leading-4">
                    {c.name}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
        {promotions.slice(0, 1).map((p) => (
          <section key={p.id} className="page-width py-3">
            <Link
              href={String(p.data.link)}
              className="flex min-h-24 items-center justify-between gap-5 rounded-2xl bg-peach/40 p-5 sm:px-7"
            >
              <div>
                <h2 className="font-serif text-xl sm:text-2xl">
                  {String(p.data.headline)}
                </h2>
                <p className="mt-1 text-xs text-ink/70">
                  {String(p.data.body)}
                </p>
              </div>
              <ArrowRight className="shrink-0 text-forest" size={22} />
            </Link>
          </section>
        ))}
        <ProductSection
          title="New arrivals"
          subtitle="Fresh stationery for your next chapter."
          products={newest}
          href="/shop?sort=newest"
        />
        <ProductSection
          title="Best sellers"
          subtitle="Popular picks from actual customer orders."
          products={bestsellers}
          href="/shop?sort=bestsellers"
        />
        {!!collections.length && (
          <section id="collections" className="page-width py-6">
            <h2 className="mb-4 font-serif text-2xl">
              A collection for every chapter.
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {collections.map((c) => (
                <Link
                  key={c.id}
                  href={`/shop?collection=${c.slug}`}
                  className="group relative h-36 overflow-hidden rounded-xl sm:h-44"
                >
                  <ProductImage
                    src={c.image}
                    alt={c.name}
                    sizes="(max-width: 640px) 45vw, 20vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
                  <h3 className="absolute bottom-3 left-3 right-3 font-serif text-lg text-white">
                    {c.name}
                  </h3>
                </Link>
              ))}
            </div>
          </section>
        )}
        {!!reviews.length && (
          <section className="page-width py-6">
            <h2 className="mb-4 font-serif text-2xl">
              Notes from our community
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {reviews.slice(0, 3).map((review) => (
                <article
                  key={review.id}
                  className="rounded-xl border border-ink/10 bg-white p-5"
                >
                  <p className="text-forest">{"★".repeat(review.rating)}</p>
                  <h3 className="mt-3 font-serif text-xl">{review.title}</h3>
                  <p className="mt-2 text-sm text-ink/70">{review.body}</p>
                  <p className="mt-3 text-xs text-ink/70">
                    {review.author}
                    {review.verified_purchase ? " · Verified purchase" : ""}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}
        <section className="mt-6 bg-mint/40">
          <div className="page-width grid items-center gap-5 py-8 md:grid-cols-2">
            <div>
              <h2 className="font-serif text-2xl">
                Good things, in your inbox.
              </h2>
              <p className="mt-2 text-sm text-ink/70">
                New arrivals, creative inspiration, and an occasional little
                treat.
              </p>
            </div>
            <NewsletterForm />
          </div>
        </section>
      </main>
    </StoreShell>
  );
}
