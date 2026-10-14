import type { ReactNode } from "react";
import { requireManagement } from "@/features/commerce/server";
import ManagementShell from "@/features/admin/components/management-shell";
export default async function InventoryLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ManagementShell user={await requireManagement("inventory.view")} inventory>
      {children}
    </ManagementShell>
  );
}

export const dynamic = "force-dynamic";
