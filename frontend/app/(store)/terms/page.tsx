export default function Terms() {
  return (
    <main className="page-width py-16">
      <article className="mx-auto max-w-2xl">
        <h1 className="font-serif text-4xl">Store terms</h1>
        <div className="mt-7 space-y-5 text-sm leading-7 text-ink/70">
          <p>
            Prices are shown in Nepalese Rupees. The backend verifies current
            prices, discounts, delivery fees, and available inventory when an
            order is placed.
          </p>
          <p>
            Online payment orders remain unpaid until the provider confirms the
            transaction. Cash on Delivery is collected upon delivery. A payment
            redirect alone is not proof of payment.
          </p>
          <p>
            Stock may be held temporarily during checkout. Expired holds are
            released by the backend. Backorders and preorders are allocated when
            inventory arrives.
          </p>
          <p>
            Development catalog products and their generated photographs are
            sample merchandise. The operator must replace them with verified
            product information and finalize business and consumer terms before
            public sales.
          </p>
        </div>
      </article>
    </main>
  );
}
