"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Truck, Wallet } from "lucide-react";
import Button from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import EmptyState from "@/components/ui/empty-state";
import ProductImage from "./product-image";
import { cartChanged, request } from "@/features/commerce/client";
import type {
  Address,
  Cart,
  DataRecord,
  Order,
  PaymentInitiation,
  PaymentOptions,
  Quote,
} from "@/features/commerce/types";
import type { User } from "@/features/auth/schemas";
import { message, money } from "@/lib/utils";
export default function CheckoutForm({
  user,
  addresses,
  payments,
}: {
  user: User;
  addresses: DataRecord[];
  payments: PaymentOptions;
}) {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [delivery, setDelivery] = useState("standard");
  const [coupon, setCoupon] = useState("");
  const [couponDraft, setCouponDraft] = useState("");
  const [method, setMethod] = useState("cod");
  const key = useRef<string>("");
  const [address, setAddress] = useState<Address>({
    name: user.name,
    phone: user.phone,
    line1: "",
    line2: "",
    city: "Kathmandu",
    postal_code: "",
    country: "NP",
  });
  useEffect(() => {
    key.current = crypto.randomUUID();
    let active = true;
    request<Cart>("cart")
      .then((c) => {
        if (active) setCart(c);
      })
      .catch((f) => {
        if (active) setError(message(f));
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!cart?.items.length) return;
    let active = true;
    request<Quote>("checkout/quote", {
      method: "POST",
      body: { delivery, coupon_code: coupon || null },
    })
      .then((q) => {
        if (active) {
          setQuote(q);
          setError("");
        }
      })
      .catch((f) => {
        if (active) setError(message(f));
      });
    return () => {
      active = false;
    };
  }, [cart, delivery, coupon]);
  function saved(id: string) {
    const row = addresses.find((a) => a.id === id);
    if (row)
      setAddress({
        name: String(row.data.name),
        phone: String(row.data.phone),
        line1: String(row.data.line1),
        line2: String(row.data.line2 ?? ""),
        city: String(row.data.city),
        postal_code: String(row.data.postal_code ?? ""),
        country: "NP",
      });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart || !quote) return;
    setPending(true);
    setError("");
    try {
      await request("checkout/reserve", { method: "POST" });
      const order = await request<Order>("checkout/orders", {
        method: "POST",
        body: {
          address,
          delivery,
          payment_method: method,
          coupon_code: coupon || null,
          idempotency_key: key.current,
        },
      });
      cartChanged();
      if (method !== "cod") {
        const initiation = await request<PaymentInitiation>(
          `payments/${order.id}/initiate`,
          { method: "POST" },
        );
        if (initiation.payment_url) {
          window.location.assign(initiation.payment_url);
          return;
        }
        if (initiation.form_url) {
          const form = document.createElement("form");
          form.method = "POST";
          form.action = initiation.form_url;
          for (const [name, value] of Object.entries(initiation.fields)) {
            const field = document.createElement("input");
            field.type = "hidden";
            field.name = name;
            field.value = value;
            form.appendChild(field);
          }
          document.body.appendChild(form);
          form.submit();
          return;
        }
      }
      router.replace(`/checkout/success/${order.id}`);
      router.refresh();
    } catch (failure) {
      setError(message(failure));
    } finally {
      setPending(false);
    }
  }
  if (cart && !cart.items.length)
    return (
      <EmptyState
        title="Your bag needs a little lovely"
        description="Add a product before checking out."
        href="/shop"
      />
    );
  return (
    <form onSubmit={submit} className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <section className="space-y-8">
        <div className="rounded-2xl border border-ink/10 bg-white p-6 sm:p-8">
          <h2 className="mb-6 flex items-center gap-2 font-serif text-2xl">
            <Truck size={19} />
            Where should your lovely things go?
          </h2>
          {!!addresses.length && (
            <Field htmlFor="saved-address" label="Use a saved address">
              <select
                id="saved-address"
                className="select-field mb-5"
                onChange={(e) => saved(e.target.value)}
                defaultValue=""
              >
                <option value="">Enter a new address</option>
                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {String(a.data.name)} · {String(a.data.line1)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            {(
              [
                ["name", "Full name"],
                ["phone", "Phone number"],
                ["line1", "Street address"],
                ["line2", "Apartment / landmark (optional)"],
                ["city", "City"],
                ["postal_code", "Postal code (optional)"],
              ] as const
            ).map(([field, label]) => (
              <Field key={field} htmlFor={`shipping-${field}`} label={label}>
                <Input
                  id={`shipping-${field}`}
                  value={address[field] ?? ""}
                  onChange={(e) =>
                    setAddress({ ...address, [field]: e.target.value })
                  }
                  required={!["line2", "postal_code"].includes(field)}
                  minLength={field === "phone" ? 7 : undefined}
                  maxLength={field === "phone" ? 32 : 240}
                />
              </Field>
            ))}
          </div>
          <p className="mt-5 text-xs text-ink/70">Delivery country: Nepal</p>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-white p-6 sm:p-8">
          <h2 className="mb-5 font-serif text-2xl">Choose your delivery</h2>
          <div className="space-y-3">
            {[
              ["standard", "Standard delivery"],
              ["express", "Express delivery"],
            ].map(([value, label]) => (
              <label
                key={value}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm ${delivery === value ? "border-ink bg-mint/30" : "border-ink/15"}`}
              >
                <input
                  type="radio"
                  name="delivery"
                  value={value}
                  checked={delivery === value}
                  onChange={() => {
                    setDelivery(value);
                    setQuote(null);
                  }}
                  className="accent-ink"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-white p-6 sm:p-8">
          <h2 className="mb-5 flex items-center gap-2 font-serif text-2xl">
            <Wallet size={19} />
            How would you like to pay?
          </h2>
          <div className="space-y-3">
            {[
              ["cod", "Cash on Delivery", true],
              ["esewa", "eSewa", payments.esewa],
              ["khalti", "Khalti", payments.khalti],
            ].map(([value, label, enabled]) => (
              <label
                key={String(value)}
                className={`flex items-center gap-3 rounded-xl border border-ink/15 p-4 text-sm ${enabled ? "cursor-pointer" : "opacity-40"}`}
              >
                <input
                  type="radio"
                  name="payment_method"
                  value={String(value)}
                  disabled={!enabled}
                  checked={method === value}
                  onChange={() => setMethod(String(value))}
                  className="accent-ink"
                />
                {String(label)}
                {!enabled && (
                  <span className="ml-auto text-xs">Unavailable</span>
                )}
              </label>
            ))}
          </div>
          <p className="mt-4 text-xs leading-6 text-ink/70">
            Online payments are confirmed securely by the payment provider. Cash
            on Delivery is collected when your order is delivered.
          </p>
        </div>
      </section>
      <aside className="h-fit rounded-2xl border border-ink/10 bg-white p-6 sm:p-7">
        <h2 className="font-serif text-2xl">Your little collection</h2>
        <div className="mt-6 space-y-4">
          {cart?.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-lg">
                <ProductImage src={item.image} alt={item.name} sizes="56px" />
              </div>
              <div className="flex-1 text-xs">
                <p className="font-medium">{item.name}</p>
                <p className="mt-1 text-ink/70">
                  {item.variant_name} × {item.quantity}
                </p>
              </div>
              <span className="text-xs font-semibold">{money(item.total)}</span>
            </div>
          ))}
        </div>
        <div className="my-6 flex gap-2">
          <label htmlFor="checkout-coupon" className="sr-only">
            Coupon code
          </label>
          <Input
            id="checkout-coupon"
            value={couponDraft}
            onChange={(e) => setCouponDraft(e.target.value)}
            placeholder="A little treat? Enter a code"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (couponDraft.trim() !== coupon) {
                setCoupon(couponDraft.trim());
                setQuote(null);
              }
            }}
          >
            Apply
          </Button>
        </div>
        {coupon && (
          <button
            type="button"
            onClick={() => {
              setCoupon("");
              setCouponDraft("");
              setQuote(null);
            }}
            className="mb-4 text-xs underline"
          >
            Remove coupon
          </button>
        )}
        <dl className="space-y-3 border-t border-ink/10 pt-5 text-sm">
          {[
            ["Subtotal", quote?.subtotal ?? cart?.subtotal],
            ["Delivery", quote?.shipping],
            ["Discount", quote?.discount],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <dt className="text-ink/70">{label}</dt>
              <dd>{value ? money(value) : "Calculating…"}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-ink/10 pt-4 text-base font-semibold">
            <dt>Total</dt>
            <dd>{quote ? money(quote.total) : "Calculating…"}</dd>
          </div>
        </dl>
        <Button
          type="submit"
          disabled={pending || !quote}
          className="mt-7 w-full"
        >
          <LockKeyhole size={15} />
          {pending
            ? "Placing your order…"
            : method === "cod"
              ? "Place order"
              : "Continue to payment"}
        </Button>
        <p className="mt-4 text-center text-[11px] leading-5 text-ink/70">
          By placing your order you agree to our store terms.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}
      </aside>
    </form>
  );
}
