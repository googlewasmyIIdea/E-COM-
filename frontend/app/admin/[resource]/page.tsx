import ManagementPage from "@/features/admin/management-page";
export default async function ResourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ resource: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { resource } = await params;
  return <ManagementPage resource={resource} searchParams={searchParams} />;
}
