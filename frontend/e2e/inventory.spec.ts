import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
const state: { admin_email: string; admin_password: string } = JSON.parse(
  readFileSync("/tmp/ecommerce-e2e-state.json", "utf8"),
);

test("warehouse detail, inventory holds, partial receipts, and transfers use persistent quantities", async ({
  page,
}) => {
  const stamp = Date.now().toString();
  const warehouseName = `QA warehouse ${stamp}`;
  await page.goto("/login");
  await page.getByLabel("Email address").fill(state.admin_email);
  await page.getByLabel("Password", { exact: true }).fill(state.admin_password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/inventory/warehouses");
  await page
    .getByRole("button", { name: "Add warehouse", exact: true })
    .click();
  await page.getByLabel("Warehouse name").fill(warehouseName);
  await page.getByLabel("Warehouse code").fill(`QA-${stamp}`);
  await page.getByLabel("Location", { exact: true }).fill("Lalitpur");
  await page.getByLabel("Address", { exact: true }).fill("QA studio lane");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(/Saved/);
  const warehouseRow = page.getByRole("row").filter({ hasText: warehouseName });
  await warehouseRow.getByRole("link", { name: /View warehouse/ }).click();
  await expect(
    page.getByRole("heading", { name: warehouseName, exact: true }),
  ).toBeVisible();
  await expect(page.getByText("QA studio lane", { exact: true })).toBeVisible();
  await page.goto("/inventory/stock?q=PP-001-1");
  const rows = page.getByRole("row").filter({ hasText: "PP-001-1" });
  const source = rows.filter({ hasText: "Kathmandu Studio" });
  const initial = Number(await source.locator("td").nth(3).textContent());
  await source.getByRole("button", { name: "Transfer", exact: true }).click();
  await page
    .getByLabel("Destination warehouse")
    .selectOption({ label: warehouseName });
  await page.getByLabel("Quantity", { exact: true }).fill("1");
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Browser verified stock transfer");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(/Saved/);
  await expect(source.locator("td").nth(3)).toHaveText(String(initial - 1));
  await expect(
    rows.filter({ hasText: warehouseName }).locator("td").nth(3),
  ).toHaveText("1");
  await page.goto("/inventory/reservations");
  await page
    .getByRole("button", { name: "Add reservation", exact: true })
    .click();
  await page
    .getByLabel("Stock to reserve")
    .selectOption({ label: `PP-001-1 · ${warehouseName}` });
  await page.getByLabel("Quantity", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(/Saved/);
  await page.goto("/inventory/stock?q=PP-001-1");
  const destination = rows.filter({ hasText: warehouseName });
  await expect(destination.locator("td").nth(4)).toHaveText("1");
  await expect(destination.locator("td").nth(5)).toHaveText("0");
  await page.goto("/inventory/reservations");
  await page
    .getByRole("row")
    .filter({ hasText: "active" })
    .first()
    .getByRole("button", { name: "Cancel hold", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(/Saved/);
  await page.goto("/inventory/replenishments");
  await page
    .getByRole("button", { name: "Add replenishment", exact: true })
    .click();
  await page
    .getByLabel("Stock / warehouse")
    .selectOption({ label: `PP-001-1 · ${warehouseName}` });
  await page.getByLabel("Expected quantity").fill("3");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(/Saved/);
  const replenishment = page
    .getByRole("row")
    .filter({ hasText: warehouseName });
  for (const [quantity, expectedStatus] of [
    ["1", "partial"],
    ["2", "completed"],
  ]) {
    await replenishment
      .getByRole("button", { name: "Receive", exact: true })
      .click();
    await page.getByLabel("Quantity received").fill(quantity);
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(/Saved/);
    await expect(replenishment).toContainText(expectedStatus);
  }
  await page.goto("/inventory/stock?q=PP-001-1");
  await expect(destination.locator("td").nth(3)).toHaveText("4");
  await expect(destination.locator("td").nth(4)).toHaveText("0");
  await expect(destination.locator("td").nth(5)).toHaveText("4");
});
