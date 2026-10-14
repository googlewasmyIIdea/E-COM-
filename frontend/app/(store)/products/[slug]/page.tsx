import ReportReview from "@/features/storefront/components/report-review";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PackageCheck, Truck, Star } from "lucide-react";
import { BackendError, serverRequest } from "@/features/commerce/server";
import type { Product } from "@/features/commerce/types";
import ProductGallery from "@/features/storefront/components/product-gallery";
import ProductActions from "@/features/storefront/components/product-actions";
import ProductCard from "@/features/storefront/components/product-card";
import ReviewForm from "@/features/storefront/components/review-form";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await serverRequest<Product>(`catalog/products/${slug}`);
    return {
      title: product.name,
      description: product.description.slice(0, 155),
      alternates: { canonical: `/products/${slug}` },
      openGraph: { images: product.images },
    };
  } catch {
    return { title: "Product" };
  }
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let product: Product;
  try {
    product = await serverRequest<Product>(`catalog/products/${slug}`);
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) notFound();
    throw error;
  }
  const [related, together] = await Promise.all([
    serverRequest<Product[]>(`catalog/recommendations/${slug}`),
    serverRequest<Product[]>(`catalog/bought-together/${slug}`),
  ]);
  return (
    <main className="page-width py-8 sm:py-12">
      <nav
        aria-label="Breadcrumb"
        className="mb-8 flex flex-wrap gap-2 text-xs text-ink/70"
      >
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/shop">Shop</Link>
        <span>/</span>
        <span>{product.name}</span>
      </nav>
      <div className="grid gap-10 md:grid-cols-2 lg:gap-16">
        <ProductGallery images={product.images} name={product.name} />
        <section>
          <p className="eyebrow mb-4 text-coral-ink">
            {product.brand} · {product.category_name}
          </p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
            {product.name}
          </h1>
          {product.rating && (
            <p className="mt-4 flex items-center gap-2 text-sm">
              <Star size={15} fill="currentColor" className="text-coral-ink" />
              {product.rating} · {product.review_count} approved reviews
            </p>
          )}
          <p className="mb-7 mt-5 whitespace-pre-line text-sm leading-7 text-ink/70">
            {product.description}
          </p>
          <ProductActions product={product} />
          <div className="mt-8 grid gap-3 border-t border-ink/10 pt-6 text-xs text-ink/70">
            <p className="flex items-center gap-2">
              <Truck size={16} />
              Standard delivery fee shown at checkout
            </p>
            <p className="flex items-center gap-2">
              <PackageCheck size={16} />
              Cash on Delivery available
            </p>
          </div>
        </section>
      </div>
      <section className="mt-14 border-t border-ink/10 pt-10">
        <h2 className="font-serif text-2xl">The lovely details</h2>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(product.attributes).map(([key, value]) => (
            <div key={key} className="rounded-xl bg-white p-4">
              <dt className="text-xs capitalize text-ink/70">
                {key.replaceAll("_", " ")}
              </dt>
              <dd className="mt-2 text-sm font-medium">
                {typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="mt-12 border-t border-ink/10 pt-10">
        <h2 className="font-serif text-2xl">Notes from our community</h2>
        {product.reviews.length ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {product.reviews.map((r) => (
              <article key={r.id} className="rounded-xl bg-white p-5">
                <p className="text-sm text-coral-ink">
                  {"★".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)}
                </p>
                <h3 className="mt-2 font-semibold">{r.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink/70">{r.body}</p>
                <p className="mt-4 text-xs text-ink/70">
                  {r.author}
                  {r.verified_purchase ? " · Verified purchase" : ""}
                </p>
                <ReportReview id={r.id} />
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink/70">
            No approved reviews yet. Share your experience after trying this
            lovely find.
          </p>
        )}
        <ReviewForm productId={product.id} />
      </section>
      {!!together.length && (
        <section className="pt-14">
          <h2 className="mb-3 font-serif text-3xl">Lovely together.</h2>
          <p className="mb-8 text-sm text-ink/70">
            Pairs discovered from completed customer orders.
          </p>
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            {together.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
      {!!related.length && (
        <section className="py-14">
          <h2 className="mb-8 font-serif text-3xl">
            A few more things you might love.
          </h2>
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
