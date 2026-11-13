// Checks the orders page.
import { expect, type Page, test } from "@playwright/test";

async function login(page: Page, email = "ana@pantryrun.test") {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("pantry");
  await page.getByRole("button", { name: "Sign in" }).click();
}

// Places the order this test needs, so it does not depend on another test running first.
async function placeOrder(page: Page) {
  await page.goto("/");
  await page
    .getByRole("article", { name: "Ground coffee 227 g", exact: true })
    .getByRole("button", { name: "Add" })
    .click();
  await page.goto("/basket");
  await page.getByLabel("Quantity of Ground coffee 227 g").fill("6");
  await page.getByRole("button", { name: "Update Ground coffee 227 g" }).click();
  await page.goto("/slots");
  await page.getByRole("radio", { name: /Mar 12 11:00/ }).check();
  await page.getByRole("button", { name: "Book slot" }).click();
  await expect(page).toHaveURL(/basket/);
  await page.getByRole("button", { name: "Checkout" }).click();
  await expect(page.getByRole("heading", { name: "Order PR-1001 placed" })).toBeVisible();
}

test.describe("legacy: orders", () => {
  // Every test starts from fresh shop data.
  test.beforeEach(async ({ request }) => {
    await request.post("/__test/reset");
  });

  test("orders page lists my order", async ({ page }) => {
    await login(page);
    await placeOrder(page);
    await page.goto("/orders");
    await expect(page.getByTestId("order-list")).toContainText("PR-1001");
  });
});
