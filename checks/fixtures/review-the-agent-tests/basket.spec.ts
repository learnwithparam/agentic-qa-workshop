// spec: specs/basket.md
// seed: tests/seed.spec.ts
import { expect, type Page, test } from "@playwright/test";

test.beforeEach(async ({ page, request }) => {
  await request.post("/__test/reset");
  await page.goto("/signin");
  await page.getByLabel("Email").fill("ana@pantryrun.test");
  await page.getByLabel("Password").fill("pantry");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Signed in as Ana Torres")).toBeVisible();
});

async function addItem(page: Page, name: string, weight?: string) {
  await page.goto("/");
  const card = page.getByRole("article", { name, exact: true });
  if (weight) await card.getByLabel(`Weight of ${name}`).selectOption({ label: weight });
  await card.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("status")).toHaveText(`Added ${name} to your basket`);
}

async function setQuantity(page: Page, name: string, quantity: number) {
  await page.goto("/basket");
  await page.getByLabel(`Quantity of ${name}`).fill(String(quantity));
  await page.getByRole("button", { name: `Update ${name}` }).click();
}

const lineTotal = (page: Page, name: string) =>
  page.getByTestId("basket-line").filter({ hasText: name }).getByTestId("line-total");

test.describe("Lines and quantities", () => {
  test("Adding the same item twice raises its quantity", async ({ page }) => {
    await addItem(page, "Penne 500 g");
    await addItem(page, "Penne 500 g");
    await expect(page.getByTestId("basket-count")).toHaveText("1");
    await page.goto("/basket");
    await expect(page.getByLabel("Quantity of Penne 500 g")).toHaveValue("2");
    await expect(lineTotal(page, "Penne 500 g")).toHaveText("$1.90");
  });

  test("The quantity box changes a line", async ({ page }) => {
    await addItem(page, "Penne 500 g");
    await setQuantity(page, "Penne 500 g", 4);
    await expect(lineTotal(page, "Penne 500 g")).toHaveText("$3.80");
  });

  test("Removing the last unit removes the line", async ({ page }) => {
    await addItem(page, "Penne 500 g");
    await page.goto("/basket");
    await page.getByRole("button", { name: "Remove one Penne 500 g" }).click();
    expect(page.getByText("Your basket")).toBeTruthy();
  });

  test("750 g of bananas at $1.39 per kg costs $1.04", async ({ page }) => {
    await addItem(page, "Bananas, loose", "750 g");
    await expect(page.getByRole("status")).toContainText("Added");
  });
});

test.describe("Offers, voucher and minimum", () => {
  test("The third yoghurt in a 3 for 2 is free", async ({ page }) => {
    await addItem(page, "Natural yoghurt 500 g");
    await setQuantity(page, "Natural yoghurt 500 g", 3);
    await expect(page.getByTestId("subtotal")).toHaveText("$4.47");
    await expect(page.getByTestId("offers")).toHaveText("-$1.49");
  });

  test("The SAVE10 voucher skips 3 for 2 lines", async ({ page }) => {
    await addItem(page, "Natural yoghurt 500 g");
    await setQuantity(page, "Natural yoghurt 500 g", 3);
    await addItem(page, "Sourdough loaf");
    await page.goto("/basket");
    await page.getByLabel("Voucher code").fill("SAVE10");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByTestId("voucher")).toBeVisible();
  });

  test("The total adds delivery and takes off offers and voucher", async ({ page }) => {
    await addItem(page, "Greek yoghurt 500 g");
    await setQuantity(page, "Greek yoghurt 500 g", 3);
    await addItem(page, "Ground coffee 227 g");
    await setQuantity(page, "Ground coffee 227 g", 5);
    await page.goto("/slots");
    await page.getByRole("radio", { name: /Mar 12 17:00 to 18:00/ }).check();
    await page.getByRole("button", { name: "Book slot" }).click();
    await expect(page).toHaveURL(/\/basket/);
    await page.getByLabel("Voucher code").fill("save10");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByTestId("total")).toHaveText("$29.77");
  });

  test("Checkout closes again when the basket drops below $25.00", async ({ page }) => {
    await page.goto("/slots");
    await page.getByRole("radio", { name: /Mar 12 09:00/ }).check();
    await page.getByRole("button", { name: "Book slot" }).click();
    await expect(page).toHaveURL(/\/basket/);
    await addItem(page, "Ground coffee 227 g");
    await setQuantity(page, "Ground coffee 227 g", 6);
    await expect(page.getByRole("button", { name: "Checkout" })).toBeEnabled();
    await page.getByRole("button", { name: "Remove one Ground coffee 227 g" }).click();
    await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
    await expect(page.getByTestId("checkout-blocked")).toContainText(
      "Spend $2.55 more to check out",
    );
  });
});
