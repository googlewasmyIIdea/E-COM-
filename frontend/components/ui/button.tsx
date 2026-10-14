import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export default function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral",
        {
          primary: "bg-ink text-white hover:bg-ink/85",
          secondary: "border border-ink/20 bg-white hover:bg-lavender/30",
          ghost: "hover:bg-ink/5",
          danger: "bg-red-700 text-white hover:bg-red-800",
        }[variant],
        className,
      )}
    />
  );
}
