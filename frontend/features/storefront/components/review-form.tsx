"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { request, ApiError } from "@/features/commerce/client";
import { message } from "@/lib/utils";
export default function ReviewForm({ productId }: { productId: string }) {
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await request(`catalog/products/${productId}/reviews`, {
        method: "POST",
        body: {
          rating: Number(form.get("rating")),
          title: String(form.get("title")),
          body: String(form.get("body")),
        },
      });
      setNotice("Thank you! Your review has been submitted for moderation.");
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401)
        router.push("/login");
      else setError(message(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="mt-6 max-w-xl space-y-4 rounded-2xl border border-ink/10 bg-white p-6"
    >
      <h3 className="font-serif text-xl">Share a little note</h3>
      <Field htmlFor="review-rating" label="Rating">
        <select
          id="review-rating"
          name="rating"
          className="select-field"
          defaultValue="5"
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} stars
            </option>
          ))}
        </select>
      </Field>
      <Field htmlFor="review-title" label="Review title">
        <Input id="review-title" name="title" required maxLength={160} />
      </Field>
      <Field htmlFor="review-body" label="Your review">
        <textarea
          id="review-body"
          name="body"
          className="select-field min-h-24"
          minLength={5}
          maxLength={5000}
          required
        />
      </Field>
      <Button type="submit" disabled={pending}>
        Submit review
      </Button>
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
