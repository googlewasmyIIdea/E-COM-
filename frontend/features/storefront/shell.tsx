import type { ReactNode } from "react";
import StoreHeader from "./components/store-header";
import StoreFooter from "./components/store-footer";
import { serverRequest } from "@/features/commerce/server";
import type { DataRecord, Taxonomy } from "@/features/commerce/types";
export default async function StoreShell({
  children,
}: {
  children: ReactNode;
}) {
  const [categories, settings] = await Promise.all([
    serverRequest<Taxonomy[]>("catalog/categories").catch(() => []),
    serverRequest<DataRecord[]>("store/settings").catch(() => []),
  ]);
  const announcement = settings.find((s) => s.data.key === "announcement")?.data
    .value;
  return (
    <>
      <StoreHeader
        categories={categories}
        announcement={typeof announcement === "string" ? announcement : ""}
      />
      {children}
      <StoreFooter />
    </>
  );
}
