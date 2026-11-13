// Hand-written by the previous tester. Most of it is fine.
// Some of it fails now and then, and nobody knows why.
import { expect, type Page, test } from "@playwright/test";

async function login(page: Page, email = "ana@pantryrun.test") {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("pantry");
  await page.getByRole("button", { name: "Sign in" }).click();
}
async function add(page: Page, name: string) {
  await page.goto("/");
  await page
    .getByRole("article", { name, exact: true })
    .getByRole("button", { name: "Add" })
    .click();
}
async function qty(page: Page, name: string, quantity: number) {
  await page.goto("/basket");
  await page.getByLabel(`Quantity of ${name}`).fill(String(quantity));
  await page.getByRole("button", { name: `Update ${name}` }).click();
}
async function book(page: Page, slot: RegExp) {
  await page.goto("/slots");
  await page.getByRole("radio", { name: slot }).check();
  await page.getByRole("button", { name: "Book slot" }).click();
  await expect(page).toHaveURL(/basket/);
}

// Every test starts from fresh shop data.
function resetShopBeforeEachTest() {
  test.beforeEach(async ({ request }) => {
    await request.post("/__test/reset");
  });
}

// The tests sit in a few short groups that share one title, so every test keeps its full name.
test.describe("legacy: shop", () => {
  resetShopBeforeEachTest();

  test("home page lists products", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("article")).toHaveCount(40);
  });
  test("health answers", async ({ request }) => {
    expect((await (await request.get("/health")).json()).ok).toBe(true);
  });
  test("sign in shows the shopper name", async ({ page }) => {
    await login(page);
    await expect(page.getByText("Signed in as Ana Torres")).toBeVisible();
  });
  test("wrong password is refused", async ({ page }) => {
    await page.goto("/signin");
    await page.getByLabel("Email").fill("ana@pantryrun.test");
    await page.getByLabel("Password").fill("nope");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toHaveText("Email or password is wrong.");
  });
  test("sign out", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });
  test("basket needs sign in", async ({ page }) => {
    await page.goto("/basket");
    await expect(page).toHaveURL(/signin/);
  });
});

test.describe("legacy: shop", () => {
  resetShopBeforeEachTest();

  test("out of stock items say so", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("article", { name: "Whole milk 2 L" })).toContainText(
      "Out of stock",
    );
  });
  test("3 for 2 badge shows", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("article", { name: "Greek yoghurt 500 g" }).getByText("3 for 2"),
    ).toBeVisible();
  });
  test("loose produce shows price per kg", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("article", { name: "Carrots, loose" })).toContainText("$0.99 / kg");
  });
  test("add shows a toast", async ({ page }) => {
    await login(page);
    await add(page, "Spaghetti 500 g");
    await expect(page.getByRole("status")).toHaveText("Added Spaghetti 500 g to your basket");
  });
  test("header counts lines", async ({ page }) => {
    await login(page);
    await add(page, "Spaghetti 500 g");
    await add(page, "Penne 500 g");
    await expect(page.getByTestId("basket-count")).toHaveText("2");
  });
  test("remove button empties the line", async ({ page }) => {
    await login(page);
    await add(page, "Spaghetti 500 g");
    await page.goto("/basket");
    await page.getByRole("button", { name: "Remove Spaghetti 500 g" }).click();
    await expect(page.getByTestId("empty-basket")).toBeVisible();
  });
  test("quantity 20 is allowed", async ({ page }) => {
    await login(page);
    await add(page, "Penne 500 g");
    await qty(page, "Penne 500 g", 20);
    await expect(page.getByTestId("subtotal")).toHaveText("$19.00");
  });
  test("quantity 21 is refused", async ({ page }) => {
    await login(page);
    await add(page, "Penne 500 g");
    await qty(page, "Penne 500 g", 21);
    await expect(page.getByRole("alert")).toContainText("Quantity must be from 1 to 20");
  });
});

test.describe("legacy: shop", () => {
  resetShopBeforeEachTest();

  test("bad voucher is refused", async ({ page }) => {
    await login(page);
    await add(page, "Penne 500 g");
    await page.goto("/basket");
    await page.getByLabel("Voucher code").fill("FREEFOOD");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("alert")).toHaveText("That voucher code is not valid.");
  });
  test("small basket cannot check out", async ({ page }) => {
    await login(page);
    await add(page, "Penne 500 g");
    await page.goto("/basket");
    await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
  });
  test("slots page asks guests to sign in", async ({ page }) => {
    await page.goto("/slots");
    await expect(page.getByRole("link", { name: "Sign in" }).last()).toBeVisible();
  });
  test("book slot without choosing says so", async ({ page }) => {
    await login(page);
    await page.goto("/slots");
    await page.getByRole("button", { name: "Book slot" }).click();
    await expect(page.getByRole("alert")).toHaveText("Choose a slot first.");
  });
  test("api lists slots", async ({ request }) => {
    expect(await (await request.get("/api/slots")).json()).toHaveLength(36);
  });
  test("api refuses an order without a key", async ({ request }) => {
    expect((await request.post("/api/orders", { data: {} })).status()).toBe(401);
  });
  test("chloe sees her allergen", async ({ page }) => {
    await login(page, "chloe@pantryrun.test");
    await expect(page.getByText("allergens: gluten")).toBeVisible();
  });
});

test.describe("legacy: shop", () => {
  resetShopBeforeEachTest();

  test("suggestions appear for out of stock milk", async ({ page }) => {
    await login(page);
    await add(page, "Whole milk 2 L");
    await page.goto("/basket");
    await page.getByRole("button", { name: "Suggest replacements for Whole milk 2 L" }).click();
    await page.waitForTimeout(500);
    const text = await page.getByTestId("suggestions-MLK-WH2").textContent();
    expect(text).toContain("Semi-skimmed milk 2 L");
  });
  test("next-date slots are open when the store clock is now", async ({ page, request }) => {
    await request.post("/__test/clock", { data: { at: new Date().toISOString() } });
    await login(page);
    await page.goto("/slots");
    await expect(page.getByRole("radio").first()).toBeEnabled();
  });
  test("place an order", async ({ page }) => {
    await login(page);
    await add(page, "Ground coffee 227 g");
    await qty(page, "Ground coffee 227 g", 6);
    await book(page, /Mar 12 11:00/);
    await page.getByRole("button", { name: "Checkout" }).click();
    await expect(page.getByRole("heading", { name: "Order PR-1001 placed" })).toBeVisible();
  });
});
