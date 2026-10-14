import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
const state: { admin_email: string; admin_password: string; base_url: string } =
  JSON.parse(readFileSync("/tmp/ecommerce-e2e-state.json", "utf8"));

test("admin creates product and stock; customer registers, buys COD, and sees order; admin fulfills", async ({
  browser,
}, testInfo) => {
  const stamp = Date.now().toString();
  const name = `Browser Journal ${stamp}`;
  const sku = `QA-${stamp}`;
  const admin = await browser.newContext({
    baseURL: state.base_url,
    viewport:
      testInfo.project.name === "mobile"
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
    isMobile: testInfo.project.name === "mobile",
  });
  const staff = await admin.newPage();
  await staff.goto("/login");
  await staff.getByLabel("Email address").fill(state.admin_email);
  await staff
    .getByLabel("Password", { exact: true })
    .fill(state.admin_password);
  await staff.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(staff).toHaveURL(/\/admin$/);
  await staff.goto("/admin/products");
  await staff.getByRole("button", { name: "Add product", exact: true }).click();
  await staff.getByLabel("Product name", { exact: true }).fill(name);
  await staff
    .getByLabel("Category", { exact: true })
    .selectOption({ label: "Notebooks & Journals" });
  await staff
    .getByLabel("Description", { exact: true })
    .fill("A product created through the real administration interface.");
  await staff.getByLabel("SKU", { exact: true }).fill(sku);
  await staff.getByLabel("Variant name", { exact: true }).fill("Lavender");
  await staff.getByLabel("Price (NPR)", { exact: true }).fill("790");
  await staff
    .locator("input[type=file]")
    .setInputFiles("public/images/journals.webp");
  await expect(staff.getByText("Image 1", { exact: true })).toBeVisible();
  await staff
    .getByRole("button", { name: "Create product", exact: true })
    .click();
  await expect(staff.getByRole("status")).toHaveText(/Saved/);
  await staff.goto("/inventory/stock");
  await staff.getByRole("button", { name: "Add stock", exact: true }).click();
  await staff
    .getByLabel("Warehouse", { exact: true })
    .selectOption({ label: "Kathmandu Studio" });
  const variant = await staff
    .getByRole("option", { name: new RegExp(sku) })
    .getAttribute("value");
  expect(variant).toBeTruthy();
  await staff
    .getByLabel("Product variant / SKU", { exact: true })
    .selectOption(variant!);
  await staff.getByLabel("Initial quantity", { exact: true }).fill("5");
  await staff.getByLabel("Low-stock threshold", { exact: true }).fill("2");
  await staff
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(staff.getByRole("status")).toHaveText(/Saved/);
  await staff.goto(`/inventory/stock?q=${sku}`);
  await expect(staff.getByRole("row").filter({ hasText: sku })).toContainText(
    "5",
  );
  const customer = await browser.newContext({
    baseURL: state.base_url,
    viewport:
      testInfo.project.name === "mobile"
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
    isMobile: testInfo.project.name === "mobile",
  });
  const page = await customer.newPage();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Make Every Page a Little Brighter." }),
  ).toBeVisible();
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 70));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: `/tmp/paper-petal-home-${testInfo.project.name}.png`,
    fullPage: true,
    caret: "initial",
  });
  await page.screenshot({
    path: `/tmp/paper-petal-viewport-${testInfo.project.name}.png`,
    caret: "initial",
  });
  await page.goto(`/shop?q=${encodeURIComponent(name)}`);
  await expect(page.getByText(/^1 lovely find/)).toBeVisible();
  await page.getByRole("link", { name, exact: true }).last().click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  const productUrl = page.url();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Added to your cart");
  await page.goto("/cart");
  await expect(
    page.getByRole("link", { name, exact: true }).last(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Continue to checkout" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page
    .getByRole("link", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill("Browser Customer");
  const email = `browser-${stamp}@example.com`;
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("BrowserPassword123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/account$/);
  await page.goto("/checkout");
  await page.getByLabel("Full name", { exact: true }).fill("Browser Customer");
  await page.getByLabel("Phone number", { exact: true }).fill("9800000000");
  await page
    .getByLabel("Street address", { exact: true })
    .fill("123 Studio Lane");
  await page.getByLabel("City", { exact: true }).fill("Kathmandu");
  await page.getByLabel("Coupon code", { exact: true }).fill("WELCOME10");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText("Discount", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Place order", exact: true }).click();
  await expect(page).toHaveURL(/\/checkout\/success\//);
  await expect(
    page.getByRole("heading", { name: "Thank you for your order." }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "View your order", exact: true })
    .click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await expect(page.getByText("cod / unpaid", { exact: true })).toBeVisible();
  await staff.goto(`/inventory/stock?q=${sku}`);
  const stockRow = staff.getByRole("row").filter({ hasText: sku });
  await expect(stockRow.locator("td").nth(3)).toHaveText("4");
  await expect(stockRow.locator("td").nth(5)).toHaveText("4");
  const orderNumber = await page.locator("main h2").first().textContent();
  expect(orderNumber).toBeTruthy();
  await staff.goto(`/admin/orders?q=${encodeURIComponent(orderNumber!)}`);
  const orderRow = staff.getByRole("row").filter({ hasText: orderNumber! });
  await orderRow.getByRole("button", { name: /Edit/ }).click();
  await staff
    .getByLabel("Order status", { exact: true })
    .selectOption("packed");
  await staff
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(staff.getByRole("status")).toHaveText(/Saved/);
  await expect(orderRow).toContainText("packed");
  await orderRow.getByRole("button", { name: /Edit/ }).click();
  await staff
    .getByLabel("Order status", { exact: true })
    .selectOption("shipped");
  await staff
    .getByLabel("Tracking number", { exact: true })
    .fill(`TRACK-${stamp}`);
  await staff
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(staff.getByRole("status")).toHaveText(/Saved/);
  await expect(orderRow).toContainText("shipped");
  await orderRow.getByRole("button", { name: /Edit/ }).click();
  await staff
    .getByLabel("Order status", { exact: true })
    .selectOption("delivered");
  await staff
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(staff.getByRole("status")).toHaveText(/Saved/);
  await expect(orderRow).toContainText("delivered");
  await page.reload();
  await expect(page.getByText("cod / paid", { exact: true })).toBeVisible();
  await page.goto(productUrl);
  await page
    .getByRole("button", { name: `Save ${name} to wishlist`, exact: true })
    .click();
  await page.goto("/account/wishlist");
  await expect(
    page.getByRole("link", { name, exact: true }).last(),
  ).toBeVisible();
  await page.goto(productUrl);
  const reviewTitle = `Verified journal review ${stamp}`;
  await page.getByLabel("Review title", { exact: true }).fill(reviewTitle);
  await page
    .getByLabel("Your review", { exact: true })
    .fill("Lovely paper and a smooth verified shopping experience.");
  await page
    .getByRole("button", { name: "Submit review", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(/submitted for moderation/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: reviewTitle, exact: true }),
  ).toHaveCount(0);
  await staff.goto(`/admin/reviews?q=${encodeURIComponent(reviewTitle)}`);
  await staff
    .getByRole("row")
    .filter({ hasText: reviewTitle })
    .getByRole("button", { name: /Edit/ })
    .click();
  await staff
    .getByLabel("Moderation status", { exact: true })
    .selectOption("approved");
  await staff
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(staff.getByRole("status")).toHaveText(/Saved/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: reviewTitle, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Browser Customer · Verified purchase", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Report review", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Reported for moderation.");
  await page.goto("/inventory");
  await expect(page).toHaveURL(/\/account\?notice=restricted/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await customer.close();
  await admin.close();
});
