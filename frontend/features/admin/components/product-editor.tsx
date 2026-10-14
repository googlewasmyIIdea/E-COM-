"use client";
import { useState, type FormEvent } from "react";
import { Plus, X, Upload } from "lucide-react";
import type { DataRecord, Product, JsonValue } from "@/features/commerce/types";
import { request } from "@/features/commerce/client";
import Button from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { message } from "@/lib/utils";
interface VariantDraft {
  sku: string;
  name: string;
  price: string;
  compare_at_price: string;
  color: string;
  active: boolean;
}
export default function ProductEditor({
  product,
  categories,
  collections,
  onSaved,
}: {
  product?: Product;
  categories: DataRecord[];
  collections: DataRecord[];
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [images, setImages] = useState(product?.images ?? []);
  const [variants, setVariants] = useState<VariantDraft[]>(
    product?.variants.map((v) => ({
      sku: v.sku,
      name: v.name,
      price: v.price,
      compare_at_price: v.compare_at_price ?? "",
      color: String(v.attributes.color ?? ""),
      active: v.active,
    })) ?? [
      {
        sku: "",
        name: "Default",
        price: "",
        compare_at_price: "",
        color: "",
        active: true,
      },
    ],
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  function updateVariant(
    index: number,
    key: keyof VariantDraft,
    value: string | boolean,
  ) {
    setVariants(
      variants.map((v, i) => (i === index ? { ...v, [key]: value } : v)),
    );
  }
  async function upload(files: FileList | null) {
    if (!files) return;
    setUploading(true);
    setError("");
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("file", file);
        const response = await fetch("/api/commerce/admin/uploads", {
          method: "POST",
          body: form,
        });
        const payload: unknown = await response.json();
        if (
          !response.ok ||
          typeof payload !== "object" ||
          payload === null ||
          !("url" in payload) ||
          typeof payload.url !== "string"
        )
          throw new Error(
            "Unable to upload this image. Use JPEG, PNG, or WebP below 8 MiB.",
          );
        urls.push(payload.url);
      }
      setImages([...images, ...urls].slice(0, 12));
    } catch (f) {
      setError(message(f));
    } finally {
      setUploading(false);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const attributes: Record<string, JsonValue> = { ...product?.attributes };
      for (const key of [
        "material",
        "paper_size",
        "page_count",
        "ink_color",
        "tip_size",
        "pack_quantity",
        "dimensions",
        "author",
        "publisher",
        "isbn",
        "language",
        "format",
      ]) {
        const value = String(form.get(key) ?? "").trim();
        if (value) attributes[key] = value;
        else delete attributes[key];
      }
      await request(
        product ? `admin/products/${product.id}` : "admin/products",
        {
          method: product ? "PATCH" : "POST",
          body: {
            name,
            slug,
            description: String(form.get("description")),
            brand: String(form.get("brand")),
            category_id: String(form.get("category_id")) || null,
            images,
            attributes,
            active: form.get("active") === "on",
            featured: form.get("featured") === "on",
            allow_backorder: form.get("allow_backorder") === "on",
            preorder: form.get("preorder") === "on",
            collection_ids: form.getAll("collection_ids").map(String),
            release_date: String(form.get("release_date"))
              ? new Date(String(form.get("release_date"))).toISOString()
              : null,
            variants: variants.map((v) => ({
              sku: v.sku,
              name: v.name,
              price: v.price,
              compare_at_price: v.compare_at_price || null,
              attributes: { color: v.color },
              image: null,
              active: v.active,
            })),
          },
        },
      );
      onSaved();
    } catch (f) {
      setError(message(f));
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={save} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="product-name" label="Product name">
          <Input
            id="product-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!product)
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, ""),
                );
            }}
            required
            maxLength={200}
          />
        </Field>
        <Field htmlFor="product-slug" label="Product URL name">
          <Input
            id="product-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
          />
        </Field>
        <Field htmlFor="product-category" label="Category">
          <select
            id="product-category"
            name="category_id"
            defaultValue={product?.category_id ?? ""}
            className="select-field"
          >
            <option value="">Choose a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {String(c.data.name)}
              </option>
            ))}
          </select>
        </Field>
        <Field htmlFor="product-brand" label="Brand">
          <Input
            id="product-brand"
            name="brand"
            defaultValue={product?.brand ?? "Paper & Petal"}
            maxLength={120}
          />
        </Field>
      </div>
      <Field htmlFor="product-description" label="Description">
        <textarea
          id="product-description"
          name="description"
          defaultValue={product?.description ?? ""}
          className="select-field min-h-28"
          maxLength={20000}
        />
      </Field>
      <div>
        <p className="mb-3 text-sm font-medium">Product photographs</p>
        <div className="flex flex-wrap gap-2">
          {images.map((src, i) => (
            <span
              key={`${src}-${i}`}
              className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs"
            >
              <a href={src} target="_blank" rel="noreferrer">
                Image {i + 1}
              </a>
              <button
                type="button"
                aria-label={`Remove image ${i + 1}`}
                onClick={() =>
                  setImages(images.filter((_, index) => index !== i))
                }
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-ink/20 px-4 py-3 text-xs">
          <Upload size={16} />
          {uploading ? "Uploading…" : "Upload photographs"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => upload(e.target.files)}
            className="sr-only"
            disabled={uploading}
          />
        </label>
        <p className="mt-2 text-[11px] text-ink/70">
          JPEG, PNG, or WebP · up to 8 MiB each
        </p>
      </div>
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-semibold">
          Sellable variants
        </legend>
        {variants.map((v, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-xl border border-ink/10 bg-white p-4 sm:grid-cols-2"
          >
            <Field htmlFor={`sku-${index}`} label="SKU">
              <Input
                id={`sku-${index}`}
                value={v.sku}
                onChange={(e) => updateVariant(index, "sku", e.target.value)}
                required
              />
            </Field>
            <Field htmlFor={`variant-${index}`} label="Variant name">
              <Input
                id={`variant-${index}`}
                value={v.name}
                onChange={(e) => updateVariant(index, "name", e.target.value)}
                required
              />
            </Field>
            <Field htmlFor={`price-${index}`} label="Price (NPR)">
              <Input
                id={`price-${index}`}
                type="number"
                min="0"
                step="0.01"
                value={v.price}
                onChange={(e) => updateVariant(index, "price", e.target.value)}
                required
              />
            </Field>
            <Field
              htmlFor={`compare-${index}`}
              label="Original price (optional)"
            >
              <Input
                id={`compare-${index}`}
                type="number"
                min="0"
                step="0.01"
                value={v.compare_at_price}
                onChange={(e) =>
                  updateVariant(index, "compare_at_price", e.target.value)
                }
              />
            </Field>
            <Field htmlFor={`color-${index}`} label="Color">
              <Input
                id={`color-${index}`}
                value={v.color}
                onChange={(e) => updateVariant(index, "color", e.target.value)}
              />
            </Field>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={v.active}
                onChange={(e) =>
                  updateVariant(index, "active", e.target.checked)
                }
              />
              Variant available
            </label>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setVariants([
              ...variants,
              {
                sku: "",
                name: "",
                price: "",
                compare_at_price: "",
                color: "",
                active: true,
              },
            ])
          }
        >
          <Plus size={15} />
          Add variant
        </Button>
      </fieldset>
      <details>
        <summary className="cursor-pointer text-sm font-semibold">
          Product specifications
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            ["material", "Material"],
            ["paper_size", "Paper size"],
            ["page_count", "Page count"],
            ["ink_color", "Ink color"],
            ["tip_size", "Pen tip size"],
            ["pack_quantity", "Pack quantity"],
            ["dimensions", "Dimensions"],
            ["isbn", "ISBN (books only)"],
            ["author", "Author (books only)"],
            ["publisher", "Publisher (books only)"],
            ["language", "Language (books only)"],
            ["format", "Format (books only)"],
          ].map(([key, label]) => (
            <Field key={key} htmlFor={`attribute-${key}`} label={label}>
              <Input
                id={`attribute-${key}`}
                name={key}
                defaultValue={String(product?.attributes[key] ?? "")}
              />
            </Field>
          ))}
        </div>
      </details>
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-semibold">
          Availability & collections
        </legend>
        <div className="flex flex-wrap gap-5">
          {[
            ["active", "Published", product?.active ?? true],
            ["featured", "Featured", product?.featured ?? false],
            [
              "allow_backorder",
              "Allow backorders",
              product?.allow_backorder ?? false,
            ],
            ["preorder", "Accept preorders", product?.preorder ?? false],
          ].map(([key, label, value]) => (
            <label
              key={String(key)}
              className="flex items-center gap-2 text-xs"
            >
              <input
                type="checkbox"
                name={String(key)}
                defaultChecked={!!value}
              />
              {String(label)}
            </label>
          ))}
        </div>
        <Field htmlFor="release-date" label="Release date (optional)">
          <Input
            id="release-date"
            name="release_date"
            type="date"
            defaultValue={product?.release_date?.slice(0, 10) ?? ""}
          />
        </Field>
        <div className="flex flex-wrap gap-4">
          {collections.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                name="collection_ids"
                value={c.id}
                defaultChecked={product?.collection_ids.includes(c.id) ?? false}
              />
              {String(c.data.name)}
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending || uploading} className="w-full">
        {pending ? "Saving…" : product ? "Save product" : "Create product"}
      </Button>
    </form>
  );
}
