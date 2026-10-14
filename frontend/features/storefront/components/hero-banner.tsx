import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ProductImage from "./product-image";
export default function HeroBanner() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-forest/10 bg-mint/50">
      <div className="relative z-10 w-[72%] px-4 py-3 sm:w-2/3 sm:px-7 sm:py-6">
        <p className="eyebrow mb-2 hidden text-forest sm:block">
          Thoughtful stationery. Lovely everyday.
        </p>
        <h1 className="max-w-lg font-serif text-xl leading-tight tracking-tight sm:text-4xl">
          Make Every Page a Little Brighter.
        </h1>
        <p className="mt-2 hidden text-sm text-ink/70 sm:block">
          Beautiful journals, favourite pens, and fresh inspiration for your
          desk.
        </p>
        <Link
          href="/shop"
          className="mt-3 hidden min-h-11 sm:inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2 text-xs font-semibold text-white sm:text-sm"
        >
          Shop Now <ArrowRight size={15} />
        </Link>
      </div>
      <div className="absolute inset-y-0 right-0 w-[28%] sm:w-1/3">
        <ProductImage
          src="/images/stationery-hero.webp"
          alt="Paper and Petal journals and pens"
          sizes="(max-width: 640px) 28vw, 33vw"
          priority
        />
      </div>
    </section>
  );
}
