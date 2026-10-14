import { requireCustomer } from "@/features/commerce/server";
import AccountSettings from "@/features/storefront/components/account-settings";
export default async function Settings() {
  return <AccountSettings user={await requireCustomer()} />;
}
