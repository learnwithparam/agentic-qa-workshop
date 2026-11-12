// spec: world/requirements/basket.md
import { expect, test } from "@playwright/test";
import { addItem, bookSlot, freshShop, line, setQuantity, signIn } from "./shop";

test.beforeEach(async ({ page, request }) => {
  await freshShop(request);
  await signIn(page);
});

test("adding the same item twice raises its quantity", async ({ page }) => {
  await addItem(page, "Penne 500 g");
  await addItem(page, "Penne 500 g");
  await expect(page.getByTestId("basket-count")).toHaveText("1");
  await page.goto("/basket");
  await expect(page.getByLabel("Quantity of Penne 500 g")).toHaveValue("2");
  await expect(line(page, "Penne 500 g").getByTestId("line-total")).toHaveText("$1.90");
});

test("the quantity box changes a line", async ({ page }) => {
  await addItem(page, "Penne 500 g");
  await setQuantity(page, "Penne 500 g", 4);
  await expect(line(page, "Penne 500 g").getByTestId("line-total")).toHaveText("$3.80");
});

test("removing the last unit removes the line", async ({ page }) => {
  await addItem(page, "Penne 500 g");
  await page.goto("/basket");
  await page.getByRole("button", { name: "Remove one Penne 500 g" }).click();
  await expect(page.getByTestId("basket-line")).toHaveCount(0);
  await expect(page.getByTestId("empty-basket")).toBeVisible();
  await expect(page.getByTestId("basket-count")).toHaveText("0");
});

test("750 g of bananas at $1.39 per kg costs $1.04", async ({ page }) => {
  await addItem(page, "Bananas, loose", "750 g");
  await page.goto("/basket");
  await expect(line(page, "Bananas, loose").getByTestId("line-weight")).toHaveText("750 g");
  await expect(line(page, "Bananas, loose").getByTestId("line-total")).toHaveText("$1.04");
});

test("the third yoghurt in a 3 for 2 is free", async ({ page }) => {
  await addItem(page, "Natural yoghurt 500 g");
  await setQuantity(page, "Natural yoghurt 500 g", 3);
  await expect(page.getByTestId("subtotal")).toHaveText("$4.47");
  await expect(page.getByTestId("offers")).toHaveText("-$1.49");
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

test("the total adds delivery and takes off offers and voucher", async ({ page }) => {
  await addItem(page, "Greek yoghurt 500 g");
  await setQuantity(page, "Greek yoghurt 500 g", 3);
  await addItem(page, "Ground coffee 227 g");
  await setQuantity(page, "Ground coffee 227 g", 5);
  await bookSlot(page, /Mar 12 17:00 to 18:00/);
  await page.getByLabel("Voucher code").fill("save10");
  await page.getByRole("button", { name: "Apply" }).click();
  // 6.87 + 22.45 - 2.29 offer - 2.25 voucher (10% of coffee only) + 4.99 delivery
  await expect(page.getByTestId("total")).toHaveText("$29.77");
});

test("checkout closes again when the basket drops below $25.00", async ({ page }) => {
  await bookSlot(page, /Mar 12 09:00/);
  await addItem(page, "Ground coffee 227 g");
  await setQuantity(page, "Ground coffee 227 g", 6);
  await expect(page.getByRole("button", { name: "Checkout" })).toBeEnabled();
  await page.getByRole("button", { name: "Remove one Ground coffee 227 g" }).click();
  await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
  await expect(page.getByTestId("checkout-blocked")).toContainText("Spend $2.55 more to check out");
});
