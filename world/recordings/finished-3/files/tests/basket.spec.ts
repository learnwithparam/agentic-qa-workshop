// spec: specs/basket.md
// seed: tests/seed.spec.ts
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const CHEDDAR = "Extra mature farmhouse cheddar 400 g";
const SLOT = "Thu, Mar 12 08:00 to 09:00, $2.99";
const MINIMUM = "The minimum order is $25.00.";

async function start(page: Page, request: APIRequestContext) {
  await request.post("/__test/reset");
  await page.goto("/signin");
  await page.getByLabel("Email").fill("ana@pantryrun.test");
  await page.getByLabel("Password").fill("pantry");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/basket");
  await expect(page.getByRole("heading", { name: "Your basket" })).toBeVisible();
  await expect(page.getByTestId("empty-basket")).toBeVisible();
}

// Adds a product from the shop page. The weight select goes back to 500 g after every Add,
// so it is picked again for each loose Add.
async function addProduct(page: Page, name: string, times = 1, grams?: number) {
  for (let i = 0; i < times; i++) {
    await page.goto("/");
    const card = page.getByRole("article", { name });
    if (grams !== undefined) {
      await card.getByLabel(`Weight of ${name}`).selectOption(String(grams));
    }
    await card.getByRole("button", { name: "Add" }).click();
    await page.waitForURL(/added=/);
  }
}

async function bookSlot(page: Page, name: string) {
  await page.goto("/slots");
  await page.getByRole("radio", { name }).check();
  await page.getByRole("button", { name: "Book slot" }).click();
  await expect(page.getByRole("status")).toHaveText("Slot booked");
}

const line = (page: Page, name: string) => page.getByTestId("basket-line").filter({ hasText: name });
const header = (page: Page, n: number) => page.getByRole("link", { name: `Basket (${n})` });

async function setQuantity(page: Page, name: string, qty: number) {
  await page.getByLabel(`Quantity of ${name}`).fill(String(qty));
  await page.getByRole("button", { name: `Update ${name}` }).click();
}

async function applyVoucher(page: Page, code: string) {
  await page.getByLabel("Voucher code").fill(code);
  await page.getByRole("button", { name: "Apply" }).click();
}

async function expectTotals(
  page: Page,
  t: { subtotal?: string; offers?: string; voucher?: string; delivery?: string; total?: string },
) {
  for (const [id, value] of Object.entries(t)) {
    await expect(page.getByTestId(id)).toHaveText(value);
  }
}

test.describe("Basket", () => {
  test("Add puts a product in the basket", async ({ page, request }) => {
    await start(page, request);

    // 1. Open `/` and click Add on "Sourdough loaf".
    await addProduct(page, "Sourdough loaf");

    // 2. Open `/basket`.
    await page.goto("/basket");

    await expect(header(page, 1)).toBeVisible();
    await expect(page.getByTestId("empty-basket")).toHaveCount(0);
    await expect(page.getByTestId("basket-line")).toHaveCount(1);
    await expect(line(page, "Sourdough loaf")).toBeVisible();
    await expect(page.getByLabel("Quantity of Sourdough loaf")).toHaveValue("1");
    await expect(line(page, "Sourdough loaf").getByTestId("line-total")).toHaveText("$3.25");
    await expectTotals(page, { subtotal: "$3.25", total: "$3.25" });
  });

  test("Adding the same product again raises its quantity", async ({ page, request }) => {
    await start(page, request);

    // 1. On `/`, click Add on "Avocados, pack of 2" twice.
    await addProduct(page, "Avocados, pack of 2", 2);

    // 2. Open `/basket`.
    await page.goto("/basket");

    await expect(page.getByTestId("basket-line")).toHaveCount(1);
    await expect(header(page, 1)).toBeVisible();
    await expect(page.getByLabel("Quantity of Avocados, pack of 2")).toHaveValue("2");
    await expect(line(page, "Avocados, pack of 2").getByTestId("line-total")).toHaveText("$6.98");
    await expectTotals(page, { total: "$6.98" });
  });

  test("Adding loose produce again raises its weight", async ({ page, request }) => {
    await start(page, request);

    // 1. On `/`, select 250 g for "Bananas, loose" and click Add.
    // 2. Select 250 g again and click Add.
    await addProduct(page, "Bananas, loose", 2, 250);

    // 3. Open `/basket`.
    await page.goto("/basket");

    await expect(page.getByTestId("basket-line")).toHaveCount(1);
    await expect(line(page, "Bananas, loose").getByTestId("line-weight")).toHaveText("500 g");
    await expect(line(page, "Bananas, loose").getByTestId("line-total")).toHaveText("$0.70");
  });

  test("Update changes a line's quantity", async ({ page, request }) => {
    await start(page, request);

    // 1. Add "Avocados, pack of 2" once and open `/basket`.
    await addProduct(page, "Avocados, pack of 2");
    await page.goto("/basket");

    // 2. Set "Quantity of Avocados, pack of 2" to 5 and click Update.
    await setQuantity(page, "Avocados, pack of 2", 5);
    await expect(line(page, "Avocados, pack of 2").getByTestId("line-total")).toHaveText("$17.45");
    await expect(page.getByLabel("Quantity of Avocados, pack of 2")).toHaveValue("5");
    await expectTotals(page, { total: "$17.45" });
    await expect(header(page, 1)).toBeVisible();

    // 3. Set it to 2 and click Update.
    await setQuantity(page, "Avocados, pack of 2", 2);
    await expect(line(page, "Avocados, pack of 2").getByTestId("line-total")).toHaveText("$6.98");
    await expect(page.getByLabel("Quantity of Avocados, pack of 2")).toHaveValue("2");
    await expectTotals(page, { total: "$6.98" });
  });

  test("Update with zero or a negative quantity does not corrupt the basket", async ({ page, request }) => {
    await start(page, request);

    // 1. Add "Sourdough loaf" twice and open `/basket`.
    await addProduct(page, "Sourdough loaf", 2);
    await page.goto("/basket");
    await expect(line(page, "Sourdough loaf").getByTestId("line-total")).toHaveText("$6.50");

    // 2. Set the quantity to -1 and click Update.
    await setQuantity(page, "Sourdough loaf", -1);
    await expect(page.getByLabel("Quantity of Sourdough loaf")).toHaveValue("2");
    await expect(line(page, "Sourdough loaf").getByTestId("line-total")).toHaveText("$6.50");
    await expectTotals(page, { total: "$6.50" });

    // 3. Set the quantity to 0 and click Update.
    await setQuantity(page, "Sourdough loaf", 0);
    await expect(page.getByLabel("Quantity of Sourdough loaf")).toHaveValue("2");
    await expect(line(page, "Sourdough loaf").getByTestId("line-total")).toHaveText("$6.50");
    await expectTotals(page, { subtotal: "$6.50", total: "$6.50" });
    await expect(page.getByText(/-\$\d/)).toHaveCount(0);
  });

  test("Minus lowers a line by one and removing the last unit removes the line", async ({ page, request }) => {
    await start(page, request);

    // 1. Add "Natural yoghurt 500 g" twice and "Sourdough loaf" once, then open `/basket`.
    await addProduct(page, "Natural yoghurt 500 g", 2);
    await addProduct(page, "Sourdough loaf");
    await page.goto("/basket");
    await expect(header(page, 2)).toBeVisible();

    // 2. Click "Remove one Natural yoghurt 500 g".
    await page.getByRole("button", { name: "Remove one Natural yoghurt 500 g" }).click();
    await expect(page.getByLabel("Quantity of Natural yoghurt 500 g")).toHaveValue("1");
    await expect(line(page, "Natural yoghurt 500 g").getByTestId("line-total")).toHaveText("$1.49");
    await expect(header(page, 2)).toBeVisible();

    // 3. Click it again.
    await page.getByRole("button", { name: "Remove one Natural yoghurt 500 g" }).click();
    await expect(line(page, "Natural yoghurt 500 g")).toHaveCount(0);
    await expect(header(page, 1)).toBeVisible();
    await expectTotals(page, { subtotal: "$3.25" });
  });

  test("Minus on loose produce removes 250 g and removes the line at zero", async ({ page, request }) => {
    await start(page, request);

    // 1. Add "Bananas, loose" at 500 g and open `/basket`.
    await addProduct(page, "Bananas, loose", 1, 500);
    await page.goto("/basket");
    await expect(line(page, "Bananas, loose").getByTestId("line-weight")).toHaveText("500 g");
    await expect(line(page, "Bananas, loose").getByTestId("line-total")).toHaveText("$0.70");

    // 2. Click "Remove one Bananas, loose".
    await page.getByRole("button", { name: "Remove one Bananas, loose" }).click();
    await expect(line(page, "Bananas, loose").getByTestId("line-weight")).toHaveText("250 g");
    await expect(line(page, "Bananas, loose").getByTestId("line-total")).toHaveText("$0.35");
    await expectTotals(page, { total: "$0.35" });

    // 3. Click it again.
    await page.getByRole("button", { name: "Remove one Bananas, loose" }).click();
    await expect(page.getByTestId("empty-basket")).toBeVisible();
    await expect(page.getByTestId("basket-line")).toHaveCount(0);
    await expect(header(page, 0)).toBeVisible();
    await expectTotals(page, { total: "$0.00" });
  });

  test("Loose line totals round to the cent once", async ({ page, request }) => {
    await start(page, request);

    // 1. Add "Carrots, loose" 250 g, "Gala apples, loose" 250 g and "Vine tomatoes, loose" 750 g, then open `/basket`.
    await addProduct(page, "Carrots, loose", 1, 250);
    await addProduct(page, "Gala apples, loose", 1, 250);
    await addProduct(page, "Vine tomatoes, loose", 1, 750);
    await page.goto("/basket");
    await expect(line(page, "Carrots, loose").getByTestId("line-total")).toHaveText("$0.25");
    await expect(line(page, "Gala apples, loose").getByTestId("line-total")).toHaveText("$0.75");
    await expect(line(page, "Vine tomatoes, loose").getByTestId("line-total")).toHaveText("$3.37");
    await expectTotals(page, { subtotal: "$4.37" });

    // 2. Back on `/`, add "Carrots, loose" 250 g twice more and open `/basket`.
    await addProduct(page, "Carrots, loose", 2, 250);
    await page.goto("/basket");
    await expect(line(page, "Carrots, loose").getByTestId("line-weight")).toHaveText("750 g");
    await expect(line(page, "Carrots, loose").getByTestId("line-total")).toHaveText("$0.74");
  });

  test("Every third unit of a 3 for 2 product is free", async ({ page, request }) => {
    await start(page, request);

    // 1. Add "Natural yoghurt 500 g" twice and open `/basket`.
    await addProduct(page, "Natural yoghurt 500 g", 2);
    await page.goto("/basket");
    await expectTotals(page, { subtotal: "$2.98", offers: "$0.00", total: "$2.98" });

    // 2. Set the quantity to 3, then 4, then 6, clicking Update each time.
    await setQuantity(page, "Natural yoghurt 500 g", 3);
    await expectTotals(page, { subtotal: "$4.47", offers: "-$1.49", total: "$2.98" });

    await setQuantity(page, "Natural yoghurt 500 g", 4);
    await expectTotals(page, { subtotal: "$5.96", offers: "-$1.49", total: "$4.47" });

    await setQuantity(page, "Natural yoghurt 500 g", 6);
    await expectTotals(page, { subtotal: "$8.94", offers: "-$2.98", total: "$5.96" });
  });

  test("Total is subtotal minus offers minus voucher plus delivery", async ({ page, request }) => {
    await start(page, request);

    // 1. Book "Thu, Mar 12 08:00 to 09:00, $2.99" on `/slots`.
    await bookSlot(page, SLOT);

    // 2. Add coffee x2, cheddar x2, sourdough x2 and penne x4.
    await addProduct(page, "Ground coffee 227 g", 2);
    await addProduct(page, CHEDDAR, 2);
    await addProduct(page, "Sourdough loaf", 2);
    await addProduct(page, "Penne 500 g", 4);

    // 3. On `/basket`, apply voucher SAVE10.
    await page.goto("/basket");
    await applyVoucher(page, "SAVE10");

    await expectTotals(page, {
      subtotal: "$27.78",
      offers: "$0.00",
      voucher: "-$2.78",
      delivery: "$2.99",
      total: "$27.99",
    });
  });

  test("SAVE10 takes 10% off lines without a multi-buy offer", async ({ page, request }) => {
    await start(page, request);

    // 1. Add "Sourdough loaf" x2 and cheddar x2.
    await addProduct(page, "Sourdough loaf", 2);
    await addProduct(page, CHEDDAR, 2);

    // 2. On `/basket`, apply SAVE10.
    await page.goto("/basket");
    await applyVoucher(page, "SAVE10");

    await expectTotals(page, { subtotal: "$15.00", voucher: "-$1.50", total: "$13.50" });
  });

  test("SAVE10 never applies to a 3 for 2 line", async ({ page, request }) => {
    await start(page, request);

    // 1. Add cheddar x4, "Sourdough loaf" x1 and "Greek yoghurt 500 g" x3.
    await addProduct(page, CHEDDAR, 4);
    await addProduct(page, "Sourdough loaf");
    await addProduct(page, "Greek yoghurt 500 g", 3);

    // 2. On `/basket`, apply SAVE10.
    await page.goto("/basket");
    await applyVoucher(page, "SAVE10");
    await expectTotals(page, { subtotal: "$27.12", offers: "-$2.29", voucher: "-$2.03", total: "$22.80" });

    // 3. Remove the cheddar and sourdough lines.
    await page.getByRole("button", { name: `Remove ${CHEDDAR}`, exact: true }).click();
    await expect(line(page, CHEDDAR)).toHaveCount(0);
    await page.getByRole("button", { name: "Remove Sourdough loaf", exact: true }).click();
    await expect(line(page, "Sourdough loaf")).toHaveCount(0);

    await expectTotals(page, { voucher: "$0.00", offers: "-$2.29", total: "$4.58" });
  });

  test("An invalid voucher code is rejected", async ({ page, request }) => {
    await start(page, request);

    // 1. Add "Sourdough loaf" x2.
    await addProduct(page, "Sourdough loaf", 2);

    // 2. On `/basket`, apply the code BOGUS.
    await page.goto("/basket");
    await applyVoucher(page, "BOGUS");

    await expect(page.getByText("That voucher code is not valid.")).toBeVisible();
    await expectTotals(page, { voucher: "$0.00", total: "$6.50" });
  });

  test("Checkout is blocked at $24.99 and allowed at exactly $25.00", async ({ page, request }) => {
    await start(page, request);

    // 1. Book "Thu, Mar 12 08:00 to 09:00, $2.99".
    await bookSlot(page, SLOT);

    // 2. Add cheddar x4, "Sourdough loaf" x2 and "Natural yoghurt 500 g" x1, then open `/basket`.
    await addProduct(page, CHEDDAR, 4);
    await addProduct(page, "Sourdough loaf", 2);
    await addProduct(page, "Natural yoghurt 500 g");
    await page.goto("/basket");
    await expectTotals(page, { subtotal: "$24.99", total: "$27.98" });
    await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
    await expect(page.getByText(`Spend $0.01 more to check out. ${MINIMUM}`)).toBeVisible();

    // 3. Click "Remove one Natural yoghurt 500 g", add "Gala apples, loose" at 500 g ($1.50) and open `/basket`.
    await page.getByRole("button", { name: "Remove one Natural yoghurt 500 g" }).click();
    await expect(line(page, "Natural yoghurt 500 g")).toHaveCount(0);
    await addProduct(page, "Gala apples, loose", 1, 500);
    await page.goto("/basket");

    await expectTotals(page, { subtotal: "$25.00" });
    await expect(page.getByTestId("checkout-blocked")).toHaveCount(0);
    await expect(page.getByText(MINIMUM)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Checkout" })).toBeEnabled();
  });

  test("The minimum counts offers and the voucher but not delivery", async ({ page, request }) => {
    await start(page, request);

    // 1. Book "Thu, Mar 12 08:00 to 09:00, $2.99".
    await bookSlot(page, SLOT);

    // 2. Add coffee x2, cheddar x2, sourdough x2 and penne x4.
    await addProduct(page, "Ground coffee 227 g", 2);
    await addProduct(page, CHEDDAR, 2);
    await addProduct(page, "Sourdough loaf", 2);
    await addProduct(page, "Penne 500 g", 4);

    // 3. On `/basket`, apply SAVE10.
    await page.goto("/basket");
    await applyVoucher(page, "SAVE10");
    await expectTotals(page, { subtotal: "$27.78", voucher: "-$2.78" });
    await expect(page.getByRole("button", { name: "Checkout" })).toBeEnabled();

    // 4. Set the Penne quantity to 3 and click Update.
    await setQuantity(page, "Penne 500 g", 3);
    await expectTotals(page, { subtotal: "$26.83", voucher: "-$2.68", total: "$27.14" });
    await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
    await expect(page.getByText(`Spend $0.85 more to check out. ${MINIMUM}`)).toBeVisible();

    // 5. Add "Greek yoghurt 500 g" x3.
    await addProduct(page, "Greek yoghurt 500 g", 3);
    await page.goto("/basket");
    await expectTotals(page, { subtotal: "$33.70", offers: "-$2.29", voucher: "-$2.68", total: "$31.72" });
    await expect(page.getByTestId("checkout-blocked")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Checkout" })).toBeEnabled();
  });

  test("Empty basket disables checkout", async ({ page, request }) => {
    await start(page, request);

    // 1. From the seed, look at `/basket`.
    await expect(header(page, 0)).toBeVisible();
    await expect(page.getByTestId("empty-basket")).toBeVisible();
    await expect(page.getByTestId("basket-line")).toHaveCount(0);
    await expectTotals(page, { total: "$0.00" });
    await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
    await expect(page.getByText("Add something to your basket to check out.")).toBeVisible();
  });

  test("Header counts lines, not units", async ({ page, request }) => {
    await start(page, request);

    // 1. Add "Natural yoghurt 500 g" x3, "Vine tomatoes, loose" 750 g and "Sourdough loaf" x1.
    await addProduct(page, "Natural yoghurt 500 g", 3);
    await addProduct(page, "Vine tomatoes, loose", 1, 750);
    await addProduct(page, "Sourdough loaf");
    await page.goto("/basket");
    await expect(header(page, 3)).toBeVisible();

    // 2. On `/basket`, click "Remove Sourdough loaf".
    await page.getByRole("button", { name: "Remove Sourdough loaf", exact: true }).click();
    await expect(line(page, "Sourdough loaf")).toHaveCount(0);
    await expect(header(page, 2)).toBeVisible();

    // 3. Set the yoghurt quantity to 5 and click Update.
    await setQuantity(page, "Natural yoghurt 500 g", 5);
    await expect(page.getByLabel("Quantity of Natural yoghurt 500 g")).toHaveValue("5");
    await expect(header(page, 2)).toBeVisible();
  });
});
