"use client";
import Button from "@/components/ui/button";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <section className="rounded-2xl bg-white p-9">
      <h1 className="font-serif text-3xl">Unable to load this workspace</h1>
      <p className="my-5 text-sm text-ink/70">
        Check your permissions and try again shortly.
      </p>
      <Button onClick={reset}>Try again</Button>
    </section>
  );
}
