"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { request } from "@/features/commerce/client";
import { signOut } from "@/features/auth/client";
import type { User } from "@/features/auth/schemas";
import { Input, Field } from "@/components/ui/input";
import Button from "@/components/ui/button";
import { message } from "@/lib/utils";
export default function AccountSettings({ user }: { user: User }) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await request("account/profile", {
        method: "PATCH",
        body: {
          name: String(form.get("name")),
          phone: String(form.get("phone")),
          preferences: {
            ...user.preferences,
            newsletter: form.get("newsletter") === "on",
          },
        },
      });
      setNotice("Your details are saved.");
      router.refresh();
    } catch (f) {
      setError(message(f));
    } finally {
      setPending(false);
    }
  }
  async function password(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await request("auth/password/change", {
        method: "POST",
        body: {
          current_password: String(form.get("current_password")),
          password: String(form.get("password")),
        },
      });
      await signOut();
      router.replace("/login");
      router.refresh();
    } catch (f) {
      setError(message(f));
    } finally {
      setPending(false);
    }
  }
  async function verify() {
    try {
      const result = await request<{ detail: string }>(
        "auth/verification/request",
        { method: "POST" },
      );
      setNotice(result.detail);
    } catch (f) {
      setError(message(f));
    }
  }
  return (
    <section className="grid gap-7 lg:grid-cols-2">
      <form onSubmit={save} className="space-y-5 rounded-2xl bg-white p-7">
        <h2 className="font-serif text-2xl">Your details</h2>
        <Field htmlFor="profile-name" label="Your name">
          <Input
            id="profile-name"
            name="name"
            defaultValue={user.name}
            maxLength={120}
          />
        </Field>
        <Field htmlFor="profile-phone" label="Phone number">
          <Input
            id="profile-phone"
            name="phone"
            defaultValue={user.phone}
            maxLength={32}
          />
        </Field>
        <p className="text-sm text-ink/70">Email: {user.email}</p>
        {!user.email_verified && (
          <button type="button" onClick={verify} className="text-xs underline">
            Request email verification
          </button>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="newsletter"
            defaultChecked={user.preferences.newsletter === true}
          />
          I’d like occasional stationery news.
        </label>
        <Button type="submit" disabled={pending}>
          Save details
        </Button>
      </form>
      <form onSubmit={password} className="space-y-5 rounded-2xl bg-white p-7">
        <h2 className="font-serif text-2xl">A new password</h2>
        <Field htmlFor="current-password" label="Current password">
          <Input
            id="current-password"
            name="current_password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <Field htmlFor="changed-password" label="New password">
          <Input
            id="changed-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
          />
          <p className="text-xs text-ink/70">
            At least 10 characters with letters and numbers. You’ll sign in
            again afterward.
          </p>
        </Field>
        <Button type="submit" disabled={pending}>
          Update password
        </Button>
      </form>
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
    </section>
  );
}
