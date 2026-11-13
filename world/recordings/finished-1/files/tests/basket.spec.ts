// spec: specs/basket.md
// seed: tests/seed.spec.ts
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const CLOCK = "2026-03-10T12:00:00-05:00";
const MILK = "Semi-skimmed milk 2 L";
const OAT = "Oat drink 1 L";
const PENNE = "Penne 500 g";
const WATER = "Sparkling water 6 x 500 ml";
const RICE = "Basmati rice 1 kg";
const CHEDDAR = "Extra mature farmhouse cheddar 400 g";
const BUTTER = "Salted butter 250 g";
const SOURDOUGH = "Sourdough loaf";
const NATURAL = "Natural yoghurt 500 g";
const GREEK = "Greek yoghurt 500 g";
const BANANAS = "Bananas, loose";
const TOMATOES = "Vine tomatoes, loose";
const CARROTS = "Carrots, loose";

async function startShop(request: APIRequestContext, page: Page) {
  await request.post("/__test/reset");
  await request.post("/__test/clock", { data: { at: CLOCK } });
  await page.goto("/signin");
  await page.getByLabel("Email").fill("ana@pantryrun.test");
  await page.getByLabel("Password").fill("pantry");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/basket");
  await expect(page.getByRole("heading", { name: "Your basket" })).toBeVisible();
}

async function addProduct(page: Page, name: string, weight?: string) {
  await page.goto("/");
  const card = page.getByRole("article", { name, exact: true });
  if (weight) {
    await card.getByLabel(`Weight of ${name}`).selectOption({ label: weight });
  }
  await card.getByRole("button", { name: "Add" }).click();
  await expect(page).toHaveURL(/added=/);
}

async function setQuantity(page: Page, name: string, qty: number) {
  await page.goto("/basket");
  await page.getByLabel(`Quantity of ${name}`).fill(String(qty));
  await page.getByRole("button", { name: `Update ${name}` }).click();
  await expect(page.getByLabel(`Quantity of ${name}`)).toHaveValue(String(qty));
}

async function addWithQuantity(page: Page, name: string, qty: number) {
  await addProduct(page, name);
  await setQuantity(page, name, qty);
}

async function bookSlot(page: Page, name: string) {
  await page.goto("/slots");
  await page.getByRole("radio", { name }).check();
  await page.getByRole("button", { name: "Book slot" }).click();
  await expect(page.getByRole("status")).toHaveText("Slot booked");
}

async function applyVoucher(page: Page, code: string) {
  await page.getByLabel("Voucher code").fill(code);
  await page.getByRole("button", { name: "Apply" }).click();
}

function line(page: Page, name: string) {
  return page.getByTestId("basket-line").filter({ hasText: name });
}

test.describe("Basket", () => {
  test("Adding the same item again raises its quantity and the header counts lines", async ({ page, request }) => {
    await startShop(request, page);

    // 1. On `/`, click Add on "Semi-skimmed milk 2 L" twice.
    await addProduct(page, MILK);
    await addProduct(page, MILK);

    // 2. Click Add on "Oat drink 1 L" once.
    await addProduct(page, OAT);

    // 3. Open /basket.
    await page.goto("/basket");

    await expect(page.getByTestId("basket-line")).toHaveCount(2);
    await expect(page.getByLabel(`Quantity of ${MILK}`)).toHaveValue("2");
    await expect(line(page, MILK).getByTestId("line-total")).toHaveText("$5.58");
    await expect(page.getByLabel(`Quantity of ${OAT}`)).toHaveValue("1");
    await expect(line(page, OAT).getByTestId("line-total")).toHaveText("$1.99");
    await expect(page.getByTestId("subtotal")).toHaveText("$7.57");
    await expect(page.getByRole("link", { name: "Basket (2)" })).toBeVisible();
  });

  test("Adding loose produce again raises its weight", async ({ page, request }) => {
    await startShop(request, page);

    // 1. On `/`, Add "Bananas, loose" at 500 g.
    await addProduct(page, BANANAS, "500 g");

    // 2. Add it again at 250 g.
    await addProduct(page, BANANAS, "250 g");

    // 3. Open /basket.
    await page.goto("/basket");

    await expect(page.getByTestId("basket-line")).toHaveCount(1);
    await expect(line(page, BANANAS).getByTestId("line-weight")).toHaveText("750 g");
    await expect(line(page, BANANAS).getByTestId("line-total")).toHaveText("$1.04");
    await expect(page.getByRole("link", { name: "Basket (1)" })).toBeVisible();
  });

  test("Update changes a line quantity and rejects 0", async ({ page, request }) => {
    await startShop(request, page);

    // 1. Add "Penne 500 g" and open /basket.
    await addProduct(page, PENNE);
    await page.goto("/basket");

    // 2. Set the quantity to 4 and click Update.
    await setQuantity(page, PENNE, 4);
    await expect(page.getByTestId("subtotal")).toHaveText("$3.80");

    // 3. Set it to 0 and click Update.
    await page.getByLabel(`Quantity of ${PENNE}`).fill("0");
    await page.getByRole("button", { name: `Update ${PENNE}` }).click();

    await expect(page.getByText("Quantity must be from 1 to 20.")).toBeVisible();
    await expect(page.getByTestId("subtotal")).toHaveText("$3.80");
  });

  test("Minus lowers by one and removing the last unit removes the line", async ({ page, request }) => {
    await startShop(request, page);

    // 1. Add "Sparkling water 6 x 500 ml" and set the quantity to 2 ($5.98).
    await addWithQuantity(page, WATER, 2);
    await expect(line(page, WATER).getByTestId("line-total")).toHaveText("$5.98");

    // 2. Click "Remove one Sparkling water 6 x 500 ml".
    await page.getByRole("button", { name: `Remove one ${WATER}` }).click();
    await expect(page.getByLabel(`Quantity of ${WATER}`)).toHaveValue("1");
    await expect(page.getByTestId("subtotal")).toHaveText("$2.99");
    await expect(page.getByRole("link", { name: "Basket (1)" })).toBeVisible();

    // 3. Click it again.
    await page.getByRole("button", { name: `Remove one ${WATER}` }).click();
    await expect(page.getByTestId("basket-line")).toHaveCount(0);
    await expect(page.getByText("Your basket is empty.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Basket (0)" })).toBeVisible();
  });

  test("Minus on loose produce removes 250 g and the last 250 g removes the line", async ({ page, request }) => {
    await startShop(request, page);

    // 1. Add "Bananas, loose" at 750 g and open /basket.
    await addProduct(page, BANANAS, "750 g");
    await page.goto("/basket");
    await expect(line(page, BANANAS).getByTestId("line-weight")).toHaveText("750 g");
    await expect(line(page, BANANAS).getByTestId("line-total")).toHaveText("$1.04");

    // 2. Click "Remove one Bananas, loose" three times.
    await page.getByRole("button", { name: `Remove one ${BANANAS}` }).click();
    await expect(line(page, BANANAS).getByTestId("line-weight")).toHaveText("500 g");
    await expect(line(page, BANANAS).getByTestId("line-total")).toHaveText("$0.70");

    await page.getByRole("button", { name: `Remove one ${BANANAS}` }).click();
    await expect(line(page, BANANAS).getByTestId("line-weight")).toHaveText("250 g");
    await expect(line(page, BANANAS).getByTestId("line-total")).toHaveText("$0.35");

    await page.getByRole("button", { name: `Remove one ${BANANAS}` }).click();
    await expect(page.getByTestId("basket-line")).toHaveCount(0);
    await expect(page.getByText("Your basket is empty.")).toBeVisible();
  });

  test("Loose produce is priced per kg and rounded once per line", async ({ page, request }) => {
    await startShop(request, page);

    // 1. Add Bananas at 250 g, Vine tomatoes at 750 g and Carrots at 1500 g.
    await addProduct(page, BANANAS, "250 g");
    await addProduct(page, TOMATOES, "750 g");
    await addProduct(page, CARROTS, "1500 g");

    // 2. Open /basket.
    await page.goto("/basket");

    await expect(line(page, BANANAS).getByTestId("line-total")).toHaveText("$0.35");
    await expect(line(page, TOMATOES).getByTestId("line-total")).toHaveText("$3.37");
    await expect(line(page, CARROTS).getByTestId("line-total")).toHaveText("$1.49");
    await expect(page.getByTestId("subtotal")).toHaveText("$5.21");
    await expect(page.getByTestId("total")).toHaveText("$5.21");
    await expect(page.getByRole("link", { name: "Basket (3)" })).toBeVisible();
  });

  test("Every third unit of a 3 for 2 product is free", async ({ page, request }) => {
    await startShop(request, page);

    // 1. Add "Natural yoghurt 500 g", set the quantity to 2 and read the totals.
    await addWithQuantity(page, NATURAL, 2);
    await expect(page.getByTestId("subtotal")).toHaveText("$2.98");
    await expect(page.getByTestId("offers")).toHaveText("$0.00");
    await expect(page.getByTestId("total")).toHaveText("$2.98");
    await expect(page.getByText(/3 for 2:/)).toHaveCount(0);

    // 2. Set it to 3, then 6, reading the totals each time.
    await setQuantity(page, NATURAL, 3);
    await expect(page.getByTestId("subtotal")).toHaveText("$4.47");
    await expect(page.getByTestId("offers")).toHaveText("-$1.49");
    await expect(page.getByTestId("total")).toHaveText("$2.98");
    await expect(page.getByText("3 for 2: -$1.49")).toBeVisible();

    await setQuantity(page, NATURAL, 6);
    await expect(page.getByTestId("subtotal")).toHaveText("$8.94");
    await expect(page.getByTestId("offers")).toHaveText("-$2.98");
    await expect(page.getByTestId("total")).toHaveText("$5.96");
    await expect(page.getByText("3 for 2: -$2.98")).toBeVisible();
  });

  test("SAVE10 takes 10% off lines without a multi-buy offer", async ({ page, request }) => {
    await startShop(request, page);

    // 1. Add "Basmati rice 1 kg" and set the quantity to 2 ($5.98).
    await addWithQuantity(page, RICE, 2);
    await expect(line(page, RICE).getByTestId("line-total")).toHaveText("$5.98");

    // 2. Apply voucher SAVE10.
    await applyVoucher(page, "SAVE10");

    await expect(page.getByTestId("voucher")).toHaveText("-$0.60");
    await expect(page.getByTestId("total")).toHaveText("$5.38");
  });

  test("SAVE10 never applies to a 3 for 2 line", async ({ page, request }) => {
    await startShop(request, page);

    // 1. Add "Greek yoghurt 500 g" and set the quantity to 3.
    await addWithQuantity(page, GREEK, 3);

    // 2. Apply SAVE10.
    await applyVoucher(page, "SAVE10");
    await expect(page.getByTestId("voucher")).toHaveText("$0.00");
    await expect(page.getByTestId("total")).toHaveText("$4.58");

    // 3. Add "Basmati rice 1 kg" at quantity 2.
    await addWithQuantity(page, RICE, 2);
    await expect(page.getByTestId("subtotal")).toHaveText("$12.85");
    await expect(page.getByTestId("offers")).toHaveText("-$2.29");
    await expect(page.getByTestId("voucher")).toHaveText("-$0.60");
    await expect(page.getByTestId("total")).toHaveText("$9.96");
  });

  test("Total is subtotal minus offers minus voucher plus delivery", async ({ page, request }) => {
    await startShop(request, page);

    // 1. Add Greek yoghurt at quantity 3 and Basmati rice at quantity 2.
    await addWithQuantity(page, GREEK, 3);
    await addWithQuantity(page, RICE, 2);

    // 2. Book "Thu, Mar 12 17:00 to 18:00, $4.99".
    await bookSlot(page, "Thu, Mar 12 17:00 to 18:00, $4.99");

    // 3. Apply SAVE10.
    await applyVoucher(page, "SAVE10");

    await expect(page.getByTestId("subtotal")).toHaveText("$12.85");
    await expect(page.getByTestId("offers")).toHaveText("-$2.29");
    await expect(page.getByTestId("voucher")).toHaveText("-$0.60");
    await expect(page.getByTestId("delivery")).toHaveText("$4.99");
    await expect(page.getByTestId("total")).toHaveText("$14.95");
  });

  test("Checkout is allowed at exactly $25.00", async ({ page, request }) => {
    await startShop(request, page);

    // 1. Add cheddar at quantity 4 ($17.00), Penne at quantity 1 ($0.95) and Salted butter at quantity 3 ($7.05).
    await addWithQuantity(page, CHEDDAR, 4);
    await addProduct(page, PENNE);
    await addWithQuantity(page, BUTTER, 3);

    // 2. Book "Thu, Mar 12 16:00 to 17:00, $2.99".
    await bookSlot(page, "Thu, Mar 12 16:00 to 17:00, $2.99");

    // 3. Click Checkout.
    await expect(page.getByTestId("subtotal")).toHaveText("$25.00");
    await expect(page.getByRole("button", { name: "Checkout" })).toBeEnabled();
    await expect(page.getByText(/Spend .* more to check out/)).toHaveCount(0);
    await page.getByRole("button", { name: "Checkout" }).click();

    await expect(page.getByRole("heading", { name: "Order PR-1001 placed" })).toBeVisible();
    await expect(page.getByTestId("order-total")).toHaveText("$27.99");
  });

  test("Checkout is disabled one cent below $25.00 and says how much more to spend", async ({ page, request }) => {
    await startShop(request, page);

    // 1. Add cheddar at quantity 4, Sourdough loaf at quantity 2 and Carrots at 1500 g.
    await addWithQuantity(page, CHEDDAR, 4);
    await addWithQuantity(page, SOURDOUGH, 2);
    await addProduct(page, CARROTS, "1500 g");

    // 2. Book "Thu, Mar 12 16:00 to 17:00, $2.99".
    await bookSlot(page, "Thu, Mar 12 16:00 to 17:00, $2.99");

    await expect(page.getByTestId("subtotal")).toHaveText("$24.99");
    await expect(page.getByTestId("total")).toHaveText("$27.98");
    await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
    await expect(
      page.getByText("Spend $0.01 more to check out. The minimum order is $25.00."),
    ).toBeVisible();
  });

  test("The minimum is checked after offers and voucher", async ({ page, request }) => {
    await startShop(request, page);

    // 1. Add cheddar at quantity 6 ($25.50) and book Thu 16:00.
    await addWithQuantity(page, CHEDDAR, 6);
    await bookSlot(page, "Thu, Mar 12 16:00 to 17:00, $2.99");

    // 2. Check that Checkout is enabled.
    await expect(page.getByTestId("subtotal")).toHaveText("$25.50");
    await expect(page.getByRole("button", { name: "Checkout" })).toBeEnabled();

    // 3. Apply SAVE10.
    await applyVoucher(page, "SAVE10");

    await expect(page.getByTestId("voucher")).toHaveText("-$2.55");
    await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
    await expect(
      page.getByText("Spend $2.05 more to check out. The minimum order is $25.00."),
    ).toBeVisible();
  });
});
