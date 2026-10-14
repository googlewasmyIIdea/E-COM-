import Link from "next/link";
import { Flower2, ArrowUpRight } from "lucide-react";
export default function StoreFooter() {
  return (
    <footer className="border-t border-ink/10 bg-white/45">
      <div className="page-width grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link
            href="/"
            className="flex items-center gap-2 font-serif text-2xl"
          >
            <Flower2 size={24} className="text-coral-ink" />
            paper & petal
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-6 text-ink/70">
            Thoughtful stationery for fresh ideas, quiet moments, and
            beautifully ordinary days.
          </p>
          <p className="mt-4 text-xs text-ink/70">
            Kathmandu, Nepal · Prices in NPR
          </p>
        </div>
        <div>
          <p className="mb-5 text-xs font-semibold uppercase tracking-widest">
            Find your favourites
          </p>
          <div className="grid gap-3 text-sm text-ink/70">
            <Link href="/shop">Shop all</Link>
            <Link href="/shop?sort=newest">New arrivals</Link>
            <Link href="/shop?category=notebooks-journals">
              Notebooks & journals
            </Link>
            <Link href="/shop?category=gift-sets">Thoughtful gifts</Link>
          </div>
        </div>
        <div>
          <p className="mb-5 text-xs font-semibold uppercase tracking-widest">
            A little help
          </p>
          <div className="grid gap-3 text-sm text-ink/70">
            <Link href="/shipping">Shipping & delivery</Link>
            <Link href="/returns">Returns & care</Link>
            <Link href="/contact">Get in touch</Link>
            <Link href="/account/orders">Track your orders</Link>
          </div>
        </div>
        <div>
          <p className="mb-5 text-xs font-semibold uppercase tracking-widest">
            Your corner
          </p>
          <div className="grid gap-3 text-sm text-ink/70">
            <Link href="/account">Your account</Link>
            <Link href="/account/wishlist">Your wishlist</Link>
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/terms">Terms of service</Link>
            <Link href="/admin" className="flex items-center gap-1">
              Staff workspace <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </div>
      <div className="page-width flex flex-wrap justify-between gap-3 border-t border-ink/10 py-5 text-[11px] text-ink/70">
        <span>© {new Date().getFullYear()} Paper & Petal.</span>
        <span>Made for paper people. Cash on Delivery available.</span>
      </div>
    </footer>
  );
}
