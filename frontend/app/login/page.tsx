import { managementLanding } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Flower2 } from "lucide-react";
import LoginForm from "@/features/auth/components/login-form";
import { currentUser, SERVICE_UNAVAILABLE } from "@/features/auth/server";
import StoreShell from "@/features/storefront/shell";
import ProductImage from "@/features/storefront/components/product-image";
export const metadata: Metadata = { title: "Sign in" };
export default async function LoginPage() {
  let user = null;
  let unavailable = false;
  try {
    user = await currentUser();
  } catch {
    unavailable = true;
  }
  if (user) redirect(managementLanding(user));
  return (
    <StoreShell>
      <main className="page-width grid gap-8 py-12 lg:grid-cols-2 lg:gap-16 lg:py-20">
        <section className="relative hidden min-h-[520px] overflow-hidden rounded-3xl bg-lavender/30 lg:block">
          <ProductImage
            src="/images/stationery-hero.webp"
            alt="A desk full of lovely stationery"
            sizes="50vw"
            priority
          />
          <div className="absolute bottom-8 left-8 right-8 rounded-2xl bg-ivory/95 p-7">
            <Flower2 size={24} className="mb-4 text-coral-ink" />
            <h1 className="font-serif text-3xl">
              Your next chapter starts here.
            </h1>
            <p className="mt-3 text-sm text-ink/70">
              A place for your favourites, your orders, and your brightest
              ideas.
            </p>
          </div>
        </section>
        <section className="mx-auto flex w-full max-w-sm flex-col justify-center py-8">
          <p className="eyebrow mb-4 text-coral-ink">Lovely to see you again</p>
          <h2 className="font-serif text-4xl">Welcome back.</h2>
          <p className="mt-4 text-sm leading-6 text-ink/70">
            Sign in to your Paper &amp; Petal account.
          </p>
          {unavailable && (
            <p role="alert" className="mt-5 text-sm text-red-700">
              {SERVICE_UNAVAILABLE}
            </p>
          )}
          <LoginForm />
          <Link
            href="/forgot-password"
            className="mt-4 text-right text-xs underline"
          >
            Forgot your password?
          </Link>
          <p className="mt-8 border-t border-ink/10 pt-6 text-center text-sm text-ink/70">
            New here?{" "}
            <Link href="/register" className="font-semibold text-ink underline">
              Create an account
            </Link>
          </p>
        </section>
      </main>
    </StoreShell>
  );
}

export const dynamic = "force-dynamic";
