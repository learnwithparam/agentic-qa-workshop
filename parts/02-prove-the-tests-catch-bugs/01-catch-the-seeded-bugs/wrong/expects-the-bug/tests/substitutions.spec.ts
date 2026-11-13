// spec: specs/substitutions.md
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

async function addItem(page: Page, name: string) {
  await page.goto("/");
  await page
    .getByRole("article", { name, exact: true })
    .getByRole("button", { name: "Add" })
    .click();
  await expect(page.getByRole("status")).toHaveText(`Added ${name} to your basket`);
}

async function switchOffSubstitutes(page: Page, name: string) {
  await page.goto("/basket");
  // The switch posts its form, and the shop redirects back to a freshly drawn basket.
  const reloaded = page.waitForResponse((response) => {
    const isPageLoad = response.request().method() === "GET";
    return isPageLoad && response.url().endsWith("/basket");
  });
  await page.getByLabel(`Allow substitutes for ${name}`).uncheck();
  await reloaded;
  await page.waitForLoadState();
  await expect(page.getByLabel(`Allow substitutes for ${name}`)).not.toBeChecked();
}

// Six Ground coffee 227 g ($26.94) clears the $25.00 minimum. Book Mar 12 09:00 and check out.
async function checkOut(page: Page) {
  await addItem(page, "Ground coffee 227 g");
  await page.goto("/basket");
  await page.getByLabel("Quantity of Ground coffee 227 g").fill("6");
  await page.getByRole("button", { name: "Update Ground coffee 227 g" }).click();
  await page.goto("/slots");
  await page.getByRole("radio", { name: /Mar 12 09:00 to 10:00/ }).check();
  await page.getByRole("button", { name: "Book slot" }).click();
  await expect(page).toHaveURL(/\/basket/);
  await page.getByRole("button", { name: "Checkout" }).click();
  await expect(page).toHaveURL(/\/orders\//);
}

// The Packing cell of the order line whose Item cell is exactly this name.
const packing = (page: Page, name: string) =>
  page
    .getByTestId("order-line")
    .filter({ has: page.getByRole("cell", { name, exact: true }) })
    .getByTestId("packing");

test.describe("The shopper's choice", () => {
  test("A new line allows substitutes and an out-of-stock item is replaced", async ({ page }) => {
    await addItem(page, "Whole milk 2 L");
    await addItem(page, "Penne 500 g");
    await page.goto("/basket");
    await expect(page.getByLabel("Allow substitutes for Whole milk 2 L")).toBeChecked();
    await expect(page.getByLabel("Allow substitutes for Penne 500 g")).toBeChecked();
    await checkOut(page);
    await expect(packing(page, "Whole milk 2 L")).toHaveText(
      "Substituted with Semi-skimmed milk 2 L",
    );
    await expect(packing(page, "Penne 500 g")).toHaveText("Packed");
    await expect(packing(page, "Ground coffee 227 g")).toHaveText("Packed");
  });

  test("Switching substitutes off is respected for a chilled item", async ({ page }) => {
    await addItem(page, "Whole milk 2 L");
    await switchOffSubstitutes(page, "Whole milk 2 L");
    await checkOut(page);
    await expect(packing(page, "Whole milk 2 L")).toHaveText("Not available");
    await expect(page.getByText(/Substituted with/)).toHaveCount(0);
  });

  test("Switching substitutes off is respected for an item that is not chilled", async ({
    page,
  }) => {
    await addItem(page, "Oat granola 500 g");
    await switchOffSubstitutes(page, "Oat granola 500 g");
    await checkOut(page);
    await expect(packing(page, "Oat granola 500 g")).toHaveText("Not available");
    await expect(page.getByText(/Substituted with/)).toHaveCount(0);
  });
});

test.describe("What a substitute may be", () => {
  test("A substitute comes from the same category", async ({ page }) => {
    await addItem(page, "Smooth peanut butter 340 g");
    await checkOut(page);
    // Semi-skimmed milk 2 L costs the same $2.79 but is milk, not a spread.
    await expect(packing(page, "Smooth peanut butter 340 g")).toHaveText(
      "Substituted with Crunchy peanut butter 340 g",
    );
  });

  test("A substitute never contains a declared allergen", async ({ page }) => {
    await addItem(page, "Oat granola 500 g");
    await checkOut(page);
    // Written from what the release candidate showed: the closest price wins.
    await expect(packing(page, "Oat granola 500 g")).toHaveText(
      "Substituted with Almond crunch granola 500 g",
    );
  });

  test("A substitute costs at most 15% more", async ({ page }) => {
    await addItem(page, "Orange juice 1 L");
    await checkOut(page);
    // $2.25 + 15% = $2.58. Pineapple juice is $2.39; Freshly squeezed orange juice is $3.49.
    await expect(packing(page, "Orange juice 1 L")).toHaveText(
      "Substituted with Pineapple juice 1 L",
    );
    await expect(page.getByText(/Freshly squeezed/)).toHaveCount(0);
  });

  test("A substitute is in stock", async ({ page }) => {
    await addItem(page, "Free range eggs, 6");
    await checkOut(page);
    await expect(packing(page, "Free range eggs, 6")).toHaveText("Substituted with Barn eggs, 6");
    await page.goto("/");
    const outOfStock = "Out of stock: we will substitute unless you say no";
    await expect(
      page.getByRole("article", { name: "Barn eggs, 6", exact: true }).getByText(outOfStock),
    ).toHaveCount(0);
    await expect(
      page.getByRole("article", { name: "Free range eggs, 6", exact: true }).getByText(outOfStock),
    ).toBeVisible();
  });
});
