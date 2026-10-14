import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "min-h-11 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-sm placeholder:text-ink/70 focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/15 disabled:opacity-60",
        className,
      )}
    />
  );
}
export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
