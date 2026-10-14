"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { request } from "@/features/commerce/client";
import type { Order, PaymentInitiation } from "@/features/commerce/types";
import { message } from "@/lib/utils";
export default function OrderActions({ order }: { order: Order }) {
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function cancel() {
    setPending(true);
    try {
      await request(`orders/${order.id}/cancel`, { method: "POST" });
      setConfirm(false);
      router.refresh();
    } catch (f) {
      setError(message(f));
    } finally {
      setPending(false);
    }
  }
  async function returnOrder() {
    setPending(true);
    try {
      await request(`orders/${order.id}/return`, {
        method: "POST",
        body: { reason },
      });
      setError("");
      setReason("Return requested. The store will review your request.");
    } catch (f) {
      setError(message(f));
    } finally {
      setPending(false);
    }
  }
  async function pay() {
    setPending(true);
    try {
      const result = await request<PaymentInitiation>(
        `payments/${order.id}/initiate`,
        { method: "POST" },
      );
      if (result.payment_url) window.location.assign(result.payment_url);
      else if (result.form_url) {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = result.form_url;
        Object.entries(result.fields).forEach(([name, value]) => {
          const field = document.createElement("input");
          field.type = "hidden";
          field.name = name;
          field.value = value;
          form.appendChild(field);
        });
        document.body.appendChild(form);
        form.submit();
      }
    } catch (f) {
      setError(message(f));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-3">
        <a
          href={`/api/commerce/orders/${order.id}/invoice`}
          className="inline-flex rounded-full border border-ink/15 bg-white px-5 py-3 text-sm font-semibold"
        >
          Download invoice
        </a>
        {["processing", "paid", "pending_payment", "awaiting_stock"].includes(
          order.status,
        ) && (
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            Cancel order
          </Button>
        )}
        {order.status === "pending_payment" &&
          order.payment_method !== "cod" && (
            <Button onClick={pay} disabled={pending}>
              Complete payment
            </Button>
          )}
      </div>
      {order.status === "delivered" && (
        <div className="max-w-lg space-y-3">
          <label htmlFor="return-reason" className="text-sm font-medium">
            Request a return
          </label>
          <textarea
            id="return-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="select-field min-h-24"
            placeholder="Tell us why you’d like to return your order."
          />
          <Button
            variant="secondary"
            disabled={pending || reason.length < 5}
            onClick={returnOrder}
          >
            Submit return request
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <Modal
        title="Cancel your order?"
        open={confirm}
        onClose={() => setConfirm(false)}
      >
        <p className="text-sm leading-6 text-ink/70">
          The order will be cancelled and its allocated stock released. You can
          place a new order anytime.
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            Keep order
          </Button>
          <Button variant="danger" onClick={cancel} disabled={pending}>
            Confirm cancellation
          </Button>
        </div>
      </Modal>
    </div>
  );
}
