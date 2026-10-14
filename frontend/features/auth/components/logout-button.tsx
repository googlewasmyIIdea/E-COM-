"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "../client";

export default function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function logout(): Promise<void> {
    setPending(true);
    setError("");
    try {
      await signOut();
      router.replace("/login");
      router.refresh();
    } catch (failure: unknown) {
      setError(
        failure instanceof Error ? failure.message : "Unable to sign out.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-2">
      <button
        onClick={logout}
        disabled={pending}
        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:opacity-60"
      >
        <LogOut size={16} aria-hidden="true" />
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <p role="alert" className="max-w-xs text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
