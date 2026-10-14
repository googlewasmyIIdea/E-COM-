import type { ReactNode } from "react";
import StoreShell from "@/features/storefront/shell";
export default function StoreLayout({ children }: { children: ReactNode }) {
  return <StoreShell>{children}</StoreShell>;
}

export const dynamic = "force-dynamic";
