import { test, expect } from "@playwright/test";

test("public homepage exposes real products immediately, with working search, cart and navigation", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("link", { name: "Paper and Petal home" }),
  ).toBeVisible();
  const section = page.getByRole("region", {
    name: "Shop stationery",
    exact: true,
  });
  const cards = section.getByRole("article");
  await expect(cards).toHaveCount(12);
  const first = cards.first();
  const box = await first.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeLessThan(page.viewportSize()!.height - 100);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(first.getByText(/NPR/).first()).toBeVisible();
  const priceBox = await first.getByText(/NPR/).first().boundingBox();
  expect(priceBox!.y + priceBox!.height).toBeLessThan(
    page.viewportSize()!.height - 20,
  );
  const image = first.locator("img");
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate((node) => (node as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  const firstName = await first.locator("a").nth(1).textContent();
  expect(firstName).toBeTruthy();
  await page.screenshot({
    path: `/tmp/paper-petal-shopping-${testInfo.project.name}.png`,
    fullPage: false,
  });
  await first.getByRole("button", { name: /Add .* to cart/ }).click();
  await expect(first.getByRole("status")).toHaveText("Added to your cart");
  await expect(
    page.getByRole("link", { name: "Shopping cart, 1 items" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Shopping cart, 1 items" }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(
    page.getByRole("link", { name: firstName!, exact: true }).last(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Paper and Petal home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("region", { name: "Shop stationery", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search stationery" })
    .fill(firstName!);
  await page
    .getByRole("search")
    .getByRole("button", { name: "Search", exact: true })
    .click();
  await expect(page).toHaveURL(/\/shop\?q=/);
  await expect(
    page.getByRole("link", { name: firstName!, exact: true }).last(),
  ).toBeVisible();
  await page
    .getByRole("link", { name: firstName!, exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/\/products\//);
  await page
    .getByRole("navigation", { name: "Shop categories" })
    .getByRole("link")
    .nth(2)
    .click();
  await expect(page).toHaveURL(/\/shop\?category=/);
  await expect(
    page.getByRole("region", { name: "Products" }).getByRole("article").first(),
  ).toBeVisible();
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Your account" })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/inventory");
  await expect(page).toHaveURL(/\/login$/);
});
