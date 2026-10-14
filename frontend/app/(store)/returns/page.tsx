import Link from "next/link";
export default function Returns() {
  return (
    <main className="page-width py-16">
      <article className="mx-auto max-w-2xl">
        <p className="eyebrow mb-4 text-coral-ink">A little help</p>
        <h1 className="font-serif text-4xl">Returns & care</h1>
        <div className="mt-7 space-y-5 text-sm leading-7 text-ink/70">
          <p>
            Open a delivered order in your account and choose “Request a
            return”. Tell the store what happened so the team can review your
            request.
          </p>
          <p>
            Returns are reviewed before approval. Do not send items back until
            the store confirms how to return them. Online payment refunds
            require actual provider confirmation; a requested return does not
            automatically issue a refund.
          </p>
          <p>
            You may cancel an order while it is awaiting payment, stock, or
            preparation. Once it is shipped, cancellation is unavailable; you
            can request a return after delivery.
          </p>
          <Link
            href="/account/orders"
            className="inline-block font-semibold text-ink underline"
          >
            Open your orders →
          </Link>
        </div>
      </article>
    </main>
  );
}
