// spec: specs/basket.md
import { expect, test } from "@playwright/test";
import { addItem, basketLine, freshShopAsAna, setQuantity } from "./shop";

test.beforeEach(async ({ page }) => freshShopAsAna(page));

test("750 g of bananas at $1.39 per kg costs $1.04", async ({ page }) => {
  await addItem(page, "Bananas, loose", "750 g");
  await page.goto("/basket");
  const bananas = basketLine(page, "Bananas, loose");
  await expect(bananas.getByTestId("line-weight")).toHaveText("750 g");
  await expect(bananas.getByTestId("line-total")).toHaveText("$1.04");
});

test("removing the last unit removes the line", async ({ page }) => {
  await addItem(page, "Penne 500 g");
  await page.goto("/basket");
  await page.getByRole("button", { name: "Remove one Penne 500 g" }).click();
  await expect(page.getByTestId("basket-line")).toHaveCount(0);
  await expect(page.getByTestId("empty-basket")).toBeVisible();
});

test("the SAVE10 voucher skips 3 for 2 lines", async ({ page }) => {
  await addItem(page, "Natural yoghurt 500 g");
  await setQuantity(page, "Natural yoghurt 500 g", 3);
  await addItem(page, "Sourdough loaf");
  await page.goto("/basket");
  await page.getByLabel("Voucher code").fill("SAVE10");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByTestId("voucher")).toHaveText("-$0.33");
});
