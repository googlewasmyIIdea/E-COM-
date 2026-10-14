import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import HomeContent from "@/features/storefront/home";
import StoreHeader from "@/features/storefront/components/store-header";
import { serverRequest } from "@/features/commerce/server";
import { product } from "./product-fixture";
vi.mock("@/features/commerce/server", () => ({ serverRequest: vi.fn() }));
vi.mock("@/features/commerce/client", () => ({
  request: vi.fn().mockResolvedValue({ count: 3 }),
  cartChanged: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/features/storefront/shell", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
const categories = [
  {
    id: "category",
    name: "Notebooks",
    slug: "notebooks",
    description: "",
    image: "/images/journals.webp",
    parent_id: null,
    active: true,
  },
];
beforeEach(() => {
  vi.mocked(serverRequest).mockImplementation(async (path: string) => {
    if (path === "catalog/categories") return categories;
    if (path.startsWith("catalog/products"))
      return {
        items: Array.from(
          { length: path.includes("bestsellers") ? 0 : 12 },
          (_, i) => ({
            ...product,
            id: `product-${i}`,
            slug: `journal-${i}`,
            name: `Journal ${i}`,
          }),
        ),
        total: 54,
        page: 1,
        page_size: 12,
      };
    return [];
  });
});
it("shows a dense public product grid fetched from the backend before collections", async () => {
  render(await HomeContent());
  const grid = screen.getByRole("region", { name: "Shop stationery" });
  expect(within(grid).getAllByRole("article")).toHaveLength(12);
  expect(within(grid).getAllByText(/NPR/).length).toBeGreaterThanOrEqual(12);
  expect(
    within(grid).getAllByRole("link", { name: "Journal 0" })[0],
  ).toHaveAttribute("href", "/products/journal-0");
  expect(serverRequest).toHaveBeenCalledWith(
    expect.stringContaining("page_size=12"),
  );
  expect(
    screen.queryByRole("textbox", { name: "Password" }),
  ).not.toBeInTheDocument();
});
it("keeps a product-focused friendly error when catalog requests fail", async () => {
  vi.mocked(serverRequest).mockRejectedValue(
    new Error("SQL connection secret trace"),
  );
  render(await HomeContent());
  expect(
    screen.getByText("The shop is taking a little pause"),
  ).toBeInTheDocument();
  expect(screen.queryByText(/SQL connection/)).not.toBeInTheDocument();
});
it("exposes search and correct public navigation while cart count updates", async () => {
  render(<StoreHeader categories={categories} announcement="Free delivery" />);
  expect(
    screen.getByRole("link", { name: "Paper and Petal home" }),
  ).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/login",
  );
  expect(screen.getByRole("link", { name: "Shop" })).toHaveAttribute(
    "href",
    "/shop",
  );
  expect(screen.getByRole("search")).toHaveAttribute("action", "/shop");
  expect(
    screen.getByRole("searchbox", { name: "Search stationery" }),
  ).toHaveAttribute("name", "q");
  expect(
    await screen.findByRole("link", { name: "Shopping cart, 3 items" }),
  ).toHaveAttribute("href", "/cart");
});
