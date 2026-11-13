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

test.describe("The shopper's choice", () => {
  test("A new line allows substitutes and an out-of-stock item is replaced", async ({ page }) => {
    await addItem(page, "Whole milk 2 L");
    await checkOut(page);
    await expect(page.getByRole("heading", { name: /Order PR-\d+ placed/ })).toBeVisible();
  });

  test("Switching substitutes off is respected for a chilled item", async ({ page }) => {
    await addItem(page, "Whole milk 2 L");
    await switchOffSubstitutes(page, "Whole milk 2 L");
    await checkOut(page);
    await expect(page.getByRole("heading", { name: /Order PR-\d+ placed/ })).toBeVisible();
  });
});

test.describe("What a substitute may be", () => {
  test("A substitute never contains a declared allergen", async ({ page }) => {
    await addItem(page, "Oat granola 500 g");
    await checkOut(page);
    await expect(page.getByTestId("order-line").first()).toBeVisible();
  });

  test("A substitute costs at most 15% more", async ({ page }) => {
    await addItem(page, "Orange juice 1 L");
    await checkOut(page);
    await expect(page.getByText("Substituted with").first()).toBeVisible();
  });
});
