// Checks the orders page.
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email = "ana@pantryrun.test") {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("pantry");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("legacy: orders", () => {
  test("orders page lists my order", async ({ page }) => {
    // Expects the order "place an order" made earlier in the run.
    await login(page);
    await page.goto("/orders");
    await expect(page.getByTestId("order-list")).toContainText("PR-1001");
  });
});
