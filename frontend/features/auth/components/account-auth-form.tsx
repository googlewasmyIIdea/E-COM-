"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { request, cartChanged } from "@/features/commerce/client";
import Button from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { message } from "@/lib/utils";
export default function AccountAuthForm({
  mode,
  token = "",
}: {
  mode: "register" | "forgot" | "reset" | "verify";
  token?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setPending(true);
    try {
      if (mode === "register") {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: String(form.get("name")),
            email: String(form.get("email")),
            password: String(form.get("password")),
          }),
        });
        const payload: unknown = await response.json();
        if (!response.ok)
          throw new Error(
            typeof payload === "object" &&
              payload !== null &&
              "detail" in payload
              ? String(payload.detail)
              : "Unable to create account.",
          );
        await request("cart/merge", { method: "POST" });
        cartChanged();
        router.replace("/account");
        router.refresh();
      } else {
        const result = await request<{ detail: string }>(
          mode === "forgot"
            ? "auth/password/forgot"
            : mode === "reset"
              ? "auth/password/reset"
              : "auth/verification/confirm",
          {
            method: "POST",
            body:
              mode === "forgot"
                ? { email: String(form.get("email")) }
                : mode === "reset"
                  ? { token, password: String(form.get("password")) }
                  : { token },
          },
        );
        setNotice(result.detail);
      }
    } catch (failure) {
      setError(message(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-7 space-y-5">
      {mode === "register" && (
        <Field htmlFor="register-name" label="Your name">
          <Input
            id="register-name"
            name="name"
            autoComplete="name"
            required
            maxLength={120}
          />
        </Field>
      )}
      {(mode === "register" || mode === "forgot") && (
        <Field htmlFor="account-email" label="Email address">
          <Input
            id="account-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </Field>
      )}
      {(mode === "register" || mode === "reset") && (
        <Field htmlFor="new-password" label="Password">
          <Input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={1024}
          />
          <p className="text-xs text-ink/70">
            At least 10 characters, including letters and numbers.
          </p>
        </Field>
      )}
      <Button
        type="submit"
        disabled={
          pending || ((mode === "reset" || mode === "verify") && !token)
        }
        className="w-full"
      >
        {pending
          ? "Please wait…"
          : mode === "register"
            ? "Create account"
            : mode === "forgot"
              ? "Send reset link"
              : mode === "reset"
                ? "Update password"
                : "Verify email"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-800">
          {notice}
        </p>
      )}
    </form>
  );
}
