import Link from "next/link";
import AccountAuthForm from "@/features/auth/components/account-auth-form";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="page-width py-16">
      <section className="mx-auto max-w-md rounded-3xl border border-ink/10 bg-white p-8 sm:p-10">
        <p className="eyebrow mb-4 text-coral-ink">Paper &amp; Petal</p>
        <h1 className="font-serif text-3xl">Your lovely little corner.</h1>
        <p className="mt-4 text-sm leading-6 text-ink/70">
          Create an account for saved favourites, easier checkout, and order
          updates.
        </p>
        <AccountAuthForm mode="register" token={token} />
        <Link
          href="/login"
          className="mt-6 block text-center text-sm underline"
        >
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
