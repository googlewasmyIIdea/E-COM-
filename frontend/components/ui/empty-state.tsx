import Link from "next/link";
import { Flower2 } from "lucide-react";
export default function EmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/15 bg-white/50 px-6 py-16 text-center">
      <Flower2
        size={40}
        className="mx-auto mb-5 text-coral-ink"
        aria-hidden="true"
      />
      <h2 className="font-serif text-2xl">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink/70">
        {description}
      </p>
      {href && (
        <Link
          href={href}
          className="mt-6 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white"
        >
          {action ?? "Explore the shop"}
        </Link>
      )}
    </div>
  );
}
