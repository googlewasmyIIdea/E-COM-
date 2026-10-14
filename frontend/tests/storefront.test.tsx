import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import ProductActions from "@/features/storefront/components/product-actions";
import NewsletterForm from "@/features/storefront/components/newsletter-form";
import { request } from "@/features/commerce/client";
import type { Product } from "@/features/commerce/types";

vi.mock("@/features/commerce/client", () => ({
  request: vi.fn(),
  cartChanged: vi.fn(),
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));
const product: Product = {
  id: "product-id",
  name: "Linen Journal",
  slug: "linen-journal",
  description: "Lovely paper",
  category_id: null,
  category_name: "Journals",
  brand: "Paper & Petal",
  images: ["/images/journals.webp"],
  attributes: {},
  active: true,
  featured: false,
  allow_backorder: false,
  preorder: false,
  release_date: null,
  created_at: "2026-10-13T00:00:00Z",
  available_stock: 5,
  rating: null,
  review_count: 0,
  reviews: [],
  collection_ids: [],
  variants: [
    {
      id: "variant-id",
      product_id: "product-id",
      sku: "JOURNAL-LAV",
      name: "Lavender",
      price: "650.00",
      compare_at_price: null,
      attributes: { color: "Lavender" },
      image: null,
      active: true,
      available_stock: 5,
    },
  ],
};
beforeEach(() => {
  vi.mocked(request).mockReset();
  push.mockReset();
});
it("adds the selected variant and quantity to the real cart API", async () => {
  vi.mocked(request).mockResolvedValue({ count: 2 });
  render(<ProductActions product={product} />);
  await userEvent.click(
    screen.getByRole("button", { name: "Increase quantity" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Add to cart" }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith("cart/items", {
      method: "POST",
      body: { variant_id: "variant-id", quantity: 2 },
    }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Added to your cart",
  );
});
it("disables purchase when no stock or backorders are available", () => {
  render(
    <ProductActions
      product={{
        ...product,
        available_stock: 0,
        variants: [{ ...product.variants[0], available_stock: 0 }],
      }}
    />,
  );
  expect(screen.getByRole("button", { name: "Out of stock" })).toBeDisabled();
});
it("displays real cart errors", async () => {
  vi.mocked(request).mockRejectedValue(new Error("Not enough stock"));
  render(<ProductActions product={product} />);
  await userEvent.click(screen.getByRole("button", { name: "Add to cart" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Not enough stock",
  );
});
it("persists newsletter consent through the backend", async () => {
  vi.mocked(request).mockResolvedValue({ detail: "You are subscribed." });
  render(<NewsletterForm />);
  await userEvent.type(
    screen.getByLabelText("Your email address"),
    "reader@example.com",
  );
  await userEvent.click(
    screen.getByLabelText("I agree to receive stationery news and offers."),
  );
  await userEvent.click(screen.getByRole("button", { name: "Subscribe" }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith("newsletter", {
      method: "POST",
      body: { email: "reader@example.com", consent: true },
    }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "You are subscribed.",
  );
});
