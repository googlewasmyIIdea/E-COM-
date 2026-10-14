import { serverRequest } from "@/features/commerce/server";
import type { DataRecord } from "@/features/commerce/types";
import Link from "next/link";
export default async function Contact() {
  const settings = await serverRequest<DataRecord[]>("store/settings");
  const email = String(
    settings.find((s) => s.data.key === "contact_email")?.data.value ?? "",
  );
  return (
    <main className="page-width py-16">
      <article className="mx-auto max-w-2xl rounded-3xl bg-peach/40 p-8 sm:p-12">
        <p className="eyebrow mb-4">A little conversation</p>
        <h1 className="font-serif text-4xl">We’d love to hear from you.</h1>
        <p className="mt-6 text-sm leading-7 text-ink/70">
          For order questions, include your order number so the store can find
          your details.
        </p>
        {email && !email.endsWith(".local") ? (
          <a
            href={`mailto:${email}`}
            className="mt-6 inline-block font-semibold underline"
          >
            {email}
          </a>
        ) : (
          <p className="mt-6 text-sm">
            Public contact email has not been configured by the store yet.
          </p>
        )}
        <Link href="/account/orders" className="mt-6 block text-sm underline">
          View your orders →
        </Link>
      </article>
    </main>
  );
}
