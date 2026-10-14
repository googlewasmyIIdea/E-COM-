import WarehouseDetail from "@/features/admin/warehouse-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <WarehouseDetail id={(await params).id} />;
}
