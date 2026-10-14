export default function Privacy() {
  return (
    <main className="page-width py-16">
      <article className="mx-auto max-w-2xl">
        <h1 className="font-serif text-4xl">Your privacy matters.</h1>
        <div className="mt-7 space-y-5 text-sm leading-7 text-ink/70">
          <p>
            The store uses account information, delivery addresses, order
            records, and session cookies to provide shopping and account
            functionality. Guest carts use a private cookie to identify the
            cart.
          </p>
          <p>
            Passwords are stored as Argon2id hashes. Session tokens are stored
            as hashes in the database. The application does not collect or store
            payment-card numbers.
          </p>
          <p>
            Newsletter subscriptions require opt-in consent. Your account
            preferences can be updated in account settings. Approved product
            reviews display your chosen name or a customer label.
          </p>
          <p>
            This development store needs its operator’s final privacy terms,
            contact details, retention periods, and applicable legal review
            before public launch.
          </p>
        </div>
      </article>
    </main>
  );
}
