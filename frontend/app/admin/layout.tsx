import type { ReactNode } from "react";
import { requireManagement } from "@/features/commerce/server";
import ManagementShell from "@/features/admin/components/management-shell";
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ManagementShell user={await requireManagement()}>
      {children}
    </ManagementShell>
  );
}

export const dynamic = "force-dynamic";
