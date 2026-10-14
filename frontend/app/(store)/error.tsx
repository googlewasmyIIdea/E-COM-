"use client";
import Button from "@/components/ui/button";
export default function StoreError({ reset }: { reset: () => void }) {
  return (
    <main className="page-width py-16">
      <div className="mx-auto max-w-lg rounded-3xl bg-white p-10 text-center">
        <h1 className="font-serif text-3xl">A little pause.</h1>
        <p className="my-6 text-sm leading-7 text-ink/70">
          We’re having trouble loading this page. Please try again in a moment.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
