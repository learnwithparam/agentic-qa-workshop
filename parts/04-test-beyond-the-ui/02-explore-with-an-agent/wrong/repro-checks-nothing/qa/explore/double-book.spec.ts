// finding: a double click on Book slot books the slot twice and charges the fee twice
import { expect, test } from "@playwright/test";
import { freshShopAsAna } from "./shop";

test("a double click on Book slot books one slot", async ({ page }) => {
  await freshShopAsAna(page);
  await page.goto("/slots");
  await page.getByRole("radio", { name: /Mar 12 09:00/ }).check();
  await page.getByRole("button", { name: "Book slot" }).dblclick();
  await expect(page).toHaveURL(/\/basket/);
});
