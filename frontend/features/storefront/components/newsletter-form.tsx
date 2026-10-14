"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import Button from "@/components/ui/button";
import { request } from "@/features/commerce/client";
import { message } from "@/lib/utils";
export default function NewsletterForm() {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const result = await request<{ detail: string }>("newsletter", {
        method: "POST",
        body: {
          email: String(form.get("email")),
          consent: form.get("consent") === "on",
        },
      });
      setNotice(result.detail);
    } catch (failure) {
      setError(message(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={subscribe} className="w-full max-w-md space-y-3">
      <div className="flex gap-2">
        <label htmlFor="newsletter-email" className="sr-only">
          Your email address
        </label>
        <Input
          id="newsletter-email"
          name="email"
          type="email"
          placeholder="Your email address"
          required
        />
        <Button type="submit" disabled={pending} aria-label="Subscribe">
          <ArrowRight size={20} />
        </Button>
      </div>
      <label className="flex items-start gap-2 text-xs leading-5 text-ink/70">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-1 accent-ink"
        />
        I agree to receive stationery news and offers.
      </label>
      {notice && (
        <p role="status" className="text-sm text-emerald-800">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
