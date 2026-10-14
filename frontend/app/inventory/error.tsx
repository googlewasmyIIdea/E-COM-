"use client";

export default function InventoryError({ reset }: { reset: () => void }) {
  return (
    <section className="mx-auto my-16 max-w-md px-6 text-center">
      <h1 className="text-xl font-semibold">Unable to open your workspace</h1>
      <p className="mt-3 text-sm">
        The service may be temporarily unavailable. Try again shortly.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-lg bg-emerald-800 px-4 py-2 text-white"
      >
        Try again
      </button>
    </section>
  );
}
