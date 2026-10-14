import Link from "next/link";
export default function NotFound() {
  return (
    <main className="page-width py-24 text-center">
      <p className="eyebrow mb-5 text-coral-ink">A little lost?</p>
      <h1 className="font-serif text-4xl">
        This page slipped between the pages.
      </h1>
      <p className="mt-5 text-sm text-ink/70">
        Let’s find something lovely instead.
      </p>
      <Link
        href="/shop"
        className="mt-7 inline-flex rounded-full bg-ink px-6 py-3 text-sm text-white"
      >
        Back to the shop
      </Link>
    </main>
  );
}
