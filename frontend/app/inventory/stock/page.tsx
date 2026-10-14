import ManagementPage from "@/features/admin/management-page";
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <ManagementPage resource="stock" searchParams={searchParams} />;
}
