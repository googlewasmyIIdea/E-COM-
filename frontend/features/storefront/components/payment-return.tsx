"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { request } from "@/features/commerce/client";
import type { PaymentResult } from "@/features/commerce/types";
import { message } from "@/lib/utils";
export default function PaymentReturn({
  orderId,
  reference,
}: {
  orderId: string;
  reference: string;
}) {
  const [status, setStatus] = useState(
    "Verifying your payment with the provider…",
  );
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    if (!orderId || !reference) return;
    request<PaymentResult>(`payments/${orderId}/verify`, {
      method: "POST",
      body: { reference },
    })
      .then((result) => {
        setVerified(result.verified);
        setStatus(
          result.verified
            ? "Your payment has been confirmed."
            : `Payment is ${result.status}. It has not been marked paid.`,
        );
      })
      .catch((f) => setStatus(message(f)));
  }, [orderId, reference]);
  return (
    <section className="mx-auto max-w-lg rounded-3xl bg-white p-10 text-center">
      <h1 className="font-serif text-3xl">
        {verified ? "Thank you, lovely." : "Checking your payment."}
      </h1>
      <p role="status" className="mt-5 text-sm leading-7">
        {!orderId || !reference
          ? "We could not identify this payment. Open your order to check its status."
          : status}
      </p>
      <Link
        href={orderId ? `/account/orders/${orderId}` : "/account/orders"}
        className="mt-7 inline-flex rounded-full bg-ink px-6 py-3 text-sm text-white"
      >
        View order
      </Link>
    </section>
  );
}
