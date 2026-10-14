import { requireCustomer } from "@/features/commerce/server";
import PaymentReturn from "@/features/storefront/components/payment-return";
export default async function PaymentCallback({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireCustomer();
  const values = await searchParams;
  let reference = values.pidx ?? "";
  if (values.provider === "esewa" && values.data) {
    try {
      const data: unknown = JSON.parse(
        Buffer.from(values.data, "base64").toString(),
      );
      if (
        typeof data === "object" &&
        data !== null &&
        "transaction_uuid" in data &&
        typeof data.transaction_uuid === "string"
      )
        reference = data.transaction_uuid;
    } catch {
      /* Untrusted callback data is never treated as payment confirmation. */
    }
  }
  return (
    <main className="page-width py-16">
      <PaymentReturn orderId={values.order ?? ""} reference={reference} />
    </main>
  );
}
