// finding: the quantity box accepts -1 and lowers the basket total
import { expect, test } from "@playwright/test";
import { addItem, freshShopAsAna, setQuantity } from "./shop";

test("the quantity box refuses a negative number", async ({ page }) => {
  await freshShopAsAna(page);
  await addItem(page, "Penne 500 g");
  await setQuantity(page, "Penne 500 g", -1);
  await expect(page.getByRole("heading", { name: "Your basket" })).toBeVisible();
});
