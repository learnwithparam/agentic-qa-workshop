// finding: going back after checkout and pressing Checkout again places a second order
import { expect, test } from "@playwright/test";
import { addItem, freshShopAsAna, PARTNER, setQuantity } from "./shop";

test("going back after checkout does not place a second order", async ({ page }) => {
  await freshShopAsAna(page);
  await addItem(page, "Ground coffee 227 g");
  await setQuantity(page, "Ground coffee 227 g", 6);
  await page.goto("/slots");
  await page.getByRole("radio", { name: /Mar 12 09:00/ }).check();
  await page.getByRole("button", { name: "Book slot" }).click();
  await expect(page).toHaveURL(/\/basket/);
  await page.getByRole("button", { name: "Checkout" }).click();
  await expect(page.getByRole("heading", { name: /Order PR-1001 placed/ })).toBeVisible();
  await page.goBack();
  const checkoutButton = page.getByRole("button", { name: "Checkout" });
  if (await checkoutButton.isEnabled()) await checkoutButton.click();
  const response = await page.request.get("/api/orders?shopper=ana", { headers: PARTNER });
  expect(await response.json()).toHaveLength(1);
});
