// Repro tests for bugs no requirement names. Each one came from exploring the shop.
import { expect, test } from "@playwright/test";
import { addItem, bookSlot, freshShop, PARTNER, reachMinimum, signIn } from "./shop";

test.beforeEach(async ({ page, request }) => {
  await freshShop(request);
  await signIn(page);
});

// finding: a double click on Book slot books the slot twice
test("a double click on Book slot books one slot", async ({ page }) => {
  await page.goto("/slots");
  await page.getByRole("radio", { name: /Mar 12 09:00/ }).check();
  await page.getByRole("button", { name: "Book slot" }).dblclick();
  await expect(page).toHaveURL(/\/basket/);
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(page.getByTestId("held-slots").getByRole("listitem")).toHaveCount(1);
  await expect(page.getByTestId("delivery")).toHaveText("$2.99");
});

// finding: the quantity box takes -1 and lowers the total
test("the quantity box refuses a negative number", async ({ page }) => {
  await addItem(page, "Penne 500 g");
  await page.goto("/basket");
  await page.getByLabel("Quantity of Penne 500 g").fill("-1");
  await page.getByRole("button", { name: "Update Penne 500 g" }).click();
  await expect(page.getByRole("alert")).toContainText("Quantity must be from 1 to 20");
  await expect(page.getByTestId("subtotal")).toHaveText("$0.95");
});

// finding: Back after checkout and Checkout again places a second order
test("going back after checkout does not place a second order", async ({ page, request }) => {
  await reachMinimum(page);
  await bookSlot(page, /Mar 12 09:00/);
  await page.getByRole("button", { name: "Checkout" }).click();
  await expect(page.getByRole("heading", { name: /Order PR-1001 placed/ })).toBeVisible();
  await page.goBack();
  const again = page.getByRole("button", { name: "Checkout" });
  if (await again.isEnabled()) await again.click();
  const orders = await (await request.get("/api/orders?shopper=ana", { headers: PARTNER })).json();
  expect(orders).toHaveLength(1);
});
