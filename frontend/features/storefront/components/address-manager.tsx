"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import Modal from "@/components/ui/modal";
import type { DataRecord } from "@/features/commerce/types";
import { request } from "@/features/commerce/client";
import { message } from "@/lib/utils";
export default function AddressManager({
  addresses,
}: {
  addresses: DataRecord[];
}) {
  const [editing, setEditing] = useState<DataRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const router = useRouter();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await request(
        editing ? `account/addresses/${editing.id}` : "account/addresses",
        {
          method: editing ? "PATCH" : "POST",
          body: {
            name: String(form.get("name")),
            phone: String(form.get("phone")),
            line1: String(form.get("line1")),
            line2: String(form.get("line2")),
            city: String(form.get("city")),
            postal_code: String(form.get("postal_code")),
            country: "NP",
            is_default: form.get("is_default") === "on",
          },
        },
      );
      setOpen(false);
      setNotice("Address saved.");
      router.refresh();
    } catch (f) {
      setError(message(f));
    } finally {
      setPending(false);
    }
  }
  async function remove() {
    if (!removing) return;
    setPending(true);
    try {
      await request(`account/addresses/${removing}`, { method: "DELETE" });
      setRemoving(null);
      router.refresh();
    } catch (f) {
      setError(message(f));
    } finally {
      setPending(false);
    }
  }
  return (
    <section>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="font-serif text-3xl">Your addresses</h2>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Add address
        </Button>
      </div>
      {notice && (
        <p role="status" className="mb-5 text-sm text-emerald-800">
          {notice}
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {addresses.map((a) => (
          <article
            key={a.id}
            className="rounded-2xl border border-ink/10 bg-white p-6"
          >
            <h3 className="font-semibold">
              {String(a.data.name)}
              {a.data.is_default && (
                <span className="ml-3 text-xs text-coral-ink">Default</span>
              )}
            </h3>
            {["line1", "line2", "city", "phone"].map((key) => (
              <p key={key} className="mt-2 text-sm text-ink/70">
                {String(a.data[key] ?? "")}
              </p>
            ))}
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => {
                  setEditing(a);
                  setOpen(true);
                }}
                className="text-xs font-semibold underline"
              >
                Edit
              </button>
              <button
                onClick={() => setRemoving(a.id)}
                className="text-xs underline"
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
      {!addresses.length && (
        <p className="rounded-2xl bg-white p-8 text-sm text-ink/70">
          Save an address for a smoother next checkout.
        </p>
      )}
      <Modal
        title={editing ? "Edit address" : "Add an address"}
        open={open}
        onClose={() => setOpen(false)}
      >
        <form
          key={editing?.id ?? "new"}
          onSubmit={save}
          className="grid gap-4 sm:grid-cols-2"
        >
          {[
            ["name", "Full name"],
            ["phone", "Phone number"],
            ["line1", "Street address"],
            ["line2", "Apartment / landmark"],
            ["city", "City"],
            ["postal_code", "Postal code"],
          ].map(([name, label]) => (
            <Field key={name} htmlFor={`address-${name}`} label={label}>
              <Input
                id={`address-${name}`}
                name={name}
                defaultValue={String(editing?.data[name] ?? "")}
                required={!["line2", "postal_code"].includes(name)}
              />
            </Field>
          ))}
          <label className="col-span-full flex items-center gap-2 text-sm">
            <input
              name="is_default"
              type="checkbox"
              defaultChecked={!!editing?.data.is_default}
            />
            Set as default address
          </label>
          <Button type="submit" disabled={pending} className="col-span-full">
            Save address
          </Button>
          {error && (
            <p role="alert" className="col-span-full text-sm text-red-700">
              {error}
            </p>
          )}
        </form>
      </Modal>
      <Modal
        title="Remove this address?"
        open={!!removing}
        onClose={() => setRemoving(null)}
      >
        <p className="text-sm text-ink/70">
          This won’t change the delivery address on orders already placed.
        </p>
        <Button
          className="mt-5"
          variant="danger"
          onClick={remove}
          disabled={pending}
        >
          Remove address
        </Button>
      </Modal>
    </section>
  );
}
