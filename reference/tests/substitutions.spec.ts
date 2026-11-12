// spec: world/requirements/substitutions.md
import { expect, test } from "@playwright/test";
import { addItem, bookSlot, checkout, freshShop, line, reachMinimum, signIn } from "./shop";

test.beforeEach(async ({ page, request }) => {
  await freshShop(request);
  await signIn(page);
});

const packing = (page: import("@playwright/test").Page, sku: string) => page.locator(`[data-testid="order-line"][data-sku="${sku}"]`).getByTestId("packing");

test("new lines allow substitutes", async ({ page }) => {
  await addItem(page, "Whole milk 2 L");
  await page.goto("/basket");
  await expect(page.getByLabel("Allow substitutes for Whole milk 2 L")).toBeChecked();
});

test("no substitutes is respected for chilled milk", async ({ page }) => {
  await addItem(page, "Whole milk 2 L");
  await page.goto("/basket");
  await page.getByLabel("Allow substitutes for Whole milk 2 L").uncheck();
  await expect(page.getByLabel("Allow substitutes for Whole milk 2 L")).not.toBeChecked();
  await reachMinimum(page);
  await bookSlot(page, /Mar 12 09:00/);
  await checkout(page);
  await expect(packing(page, "MLK-WH2")).toHaveText("Not available");
});

test("a substitute never has an allergen the shopper declared", async ({ page }) => {
  // Ana declared tree nuts. Almond granola is the closest price, so the picker must skip it.
  await addItem(page, "Oat granola 500 g");
  await reachMinimum(page);
  await bookSlot(page, /Mar 12 09:00/);
  await checkout(page);
  await expect(packing(page, "GRN-OAT")).toHaveText("Substituted with Honey granola 500 g");
});

test("a substitute is same category, in stock and at most 15% dearer", async ({ page }) => {
  await addItem(page, "Orange juice 1 L");
  await reachMinimum(page);
  await bookSlot(page, /Mar 12 09:00/);
  await checkout(page);
  await expect(packing(page, "JUI-ORA")).toHaveText("Substituted with Pineapple juice 1 L");
});
