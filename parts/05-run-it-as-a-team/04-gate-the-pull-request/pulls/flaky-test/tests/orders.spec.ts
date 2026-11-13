// spec: specs/orders.md
import { expect, test } from "@playwright/test";
import { addItem, setQuantity } from "./shop";

// This test never resets the shop. It passes on a fresh shop, where the first order is
// PR-1001, and fails when it runs a second time on the same shop.
test("an order of 750 g bananas and six coffees is PR-1001 for $30.97", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("ana@pantryrun.test");
  await page.getByLabel("Password").fill("pantry");
  await page.getByRole("button", { name: "Sign in" }).click();
  await addItem(page, "Bananas, loose", "750 g");
  await addItem(page, "Ground coffee 227 g");
  await setQuantity(page, "Ground coffee 227 g", 6);
  await page.goto("/slots");
  await page.getByRole("radio", { name: /Mar 12 09:00/ }).check();
  await page.getByRole("button", { name: "Book slot" }).click();
  await page.getByRole("button", { name: "Checkout" }).click();
  await expect(page.getByRole("heading", { name: "Order PR-1001 placed" })).toBeVisible();
  await expect(page.getByTestId("order-total")).toHaveText("$30.97");
});
