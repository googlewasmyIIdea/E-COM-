import { serverRequest } from "@/features/commerce/server";
import type { DataRecord } from "@/features/commerce/types";
import Wishlist from "@/features/storefront/components/wishlist";
export default async function WishlistPage() {
  return (
    <Wishlist
      items={await serverRequest<DataRecord[]>("account/wishlist", true)}
    />
  );
}
