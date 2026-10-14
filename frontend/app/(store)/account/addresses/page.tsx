import { serverRequest } from "@/features/commerce/server";
import type { DataRecord } from "@/features/commerce/types";
import AddressManager from "@/features/storefront/components/address-manager";
export default async function Addresses() {
  return (
    <AddressManager
      addresses={await serverRequest<DataRecord[]>("account/addresses", true)}
    />
  );
}
