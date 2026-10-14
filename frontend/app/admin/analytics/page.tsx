import { requireManagement, serverRequest } from "@/features/commerce/server";
import type { Overview as Data } from "@/features/commerce/types";
import Overview from "@/features/admin/components/overview";
export default async function Analytics() {
  await requireManagement("dashboard.view");
  return (
    <Overview
      data={await serverRequest<Data>("admin/analytics", true)}
      analytics
    />
  );
}
