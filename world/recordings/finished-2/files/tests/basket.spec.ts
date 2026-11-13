// spec: specs/basket.md
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const SLOT_MORNING = "Thu, Mar 12 08:00 to 09:00, $2.99";
const SLOT_EVENING = "Thu, Mar 12 17:00 to 18:00, $4.99";

// Same start as tests/seed.spec.ts: reset, sign in, open the empty basket.
async function startFresh(page: Page, request: APIRequestContext) {
  await request.post("/__test/reset");
  await page.goto("/signin");
  await page.getByLabel("Email").fill("ana@pantryrun.test");
  await page.getByLabel("Password").fill("pantry");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/basket");
  await expect(page.getByRole("heading", { name: "Your basket" })).toBeVisible();
  await expect(page.getByTestId("empty-basket")).toBeVisible();
}

// Click a button that submits a form and wait for the page it loads next.
async function submit(page: Page, click: () => Promise<void>) {
  await Promise.all([page.waitForEvent("load"), click()]);
}

// Add a product once per call on the shop page (optionally choosing a weight first).
async function addProduct(page: Page, name: string, times = 1, weight?: string) {
  for (let i = 0; i < times; i++) {
    await page.goto("/");
    const article = page.getByRole("article", { name, exact: true });
    if (weight) {
      await article.getByLabel(`Weight of ${name}`).selectOption(weight);
    }
    await article.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("status")).toContainText(`Added ${name}`);
  }
}

function line(page: Page, name: string) {
  return page.getByTestId("basket-line").filter({ hasText: name });
}

// Type a quantity in the line's box and press Update.
async function setQuantity(page: Page, name: string, quantity: number) {
  await page.goto("/basket");
  await page.getByLabel(`Quantity of ${name}`).fill(String(quantity));
  await submit(page, () => page.getByRole("button", { name: `Update ${name}` }).click());
  await expect(page.getByLabel(`Quantity of ${name}`)).toHaveValue(String(quantity));
}

async function removeOne(page: Page, name: string) {
  await submit(page, () => page.getByRole("button", { name: `Remove one ${name}`, exact: true }).click());
}

async function bookSlot(page: Page, slot: string) {
  await page.goto("/slots");
  await page.getByRole("radio", { name: slot }).check();
  await page.getByRole("button", { name: "Book slot" }).click();
  await expect(page).toHaveURL(/\/basket/);
  await expect(page.getByTestId("held-slots")).toBeVisible();
}

async function applyVoucher(page: Page, code: string) {
  await page.goto("/basket");
  await page.getByLabel("Voucher code").fill(code);
  await submit(page, () => page.getByRole("button", { name: "Apply" }).click());
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
  test.beforeEach(async ({ page, request }) => {
    await startFresh(page, request);
  });

  test("Adding the same item twice raises its quantity on one line", async ({ page }) => {
    // 1. On / click 'Add' in the 'Sourdough loaf' article twice, then open /basket.
    await addProduct(page, "Sourdough loaf", 2);
    await page.goto("/basket");
    await expect(page.getByTestId("basket-line")).toHaveCount(1);
    await expect(line(page, "Sourdough loaf")).toBeVisible();
    await expect(page.getByLabel("Quantity of Sourdough loaf")).toHaveValue("2");
    await expect(page.getByTestId("line-total")).toHaveText("$6.50");
    await expect(page.getByRole("link", { name: "Basket (1)" })).toBeVisible();
    await expectTotals(page, { subtotal: "$6.50" });
  });

  test("Adding the same loose produce again raises its weight", async ({ page }) => {
    // 1. Choose 250 g, Add, then 500 g and Add again.
    await addProduct(page, "Carrots, loose", 1, "250 g");
    await addProduct(page, "Carrots, loose", 1, "500 g");
    await page.goto("/basket");
    await expect(page.getByTestId("basket-line")).toHaveCount(1);
    await expect(line(page, "Carrots, loose").getByTestId("line-weight")).toHaveText("750 g");
    await expect(line(page, "Carrots, loose").getByTestId("line-total")).toHaveText("$0.74");
  });

  test("Quantity box and Update set a new quantity", async ({ page }) => {
    // 1. Add once, fill the quantity with 8 and click Update.
    await addProduct(page, "Sourdough loaf");
    await setQuantity(page, "Sourdough loaf", 8);
    await expect(page.getByTestId("line-total")).toHaveText("$26.00");
    await expectTotals(page, { subtotal: "$26.00", total: "$26.00" });
    await expect(page.getByRole("link", { name: "Basket (1)" })).toBeVisible();

    // 2. Fill the quantity box with 2 and click Update.
    await setQuantity(page, "Sourdough loaf", 2);
    await expect(page.getByTestId("line-total")).toHaveText("$6.50");
  });

  test("Minus button lowers a unit line by one", async ({ page }) => {
    // 1. Add, set quantity 3, then click minus.
    await addProduct(page, "Sourdough loaf");
    await setQuantity(page, "Sourdough loaf", 3);
    await expect(page.getByTestId("line-total")).toHaveText("$9.75");
    await removeOne(page, "Sourdough loaf");
    await expect(page.getByLabel("Quantity of Sourdough loaf")).toHaveValue("2");
    await expect(page.getByTestId("line-total")).toHaveText("$6.50");
    await expectTotals(page, { subtotal: "$6.50" });
  });

  test("Minus on the last unit removes the line", async ({ page }) => {
    // 1. Add Penne once; open /basket; click minus.
    await addProduct(page, "Penne 500 g");
    await page.goto("/basket");
    await expect(page.getByTestId("basket-line")).toHaveCount(1);
    await removeOne(page, "Penne 500 g");
    await expect(page.getByTestId("basket-line")).toHaveCount(0);
    await expect(page.getByText("Your basket is empty.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Basket (0)" })).toBeVisible();
    await expectTotals(page, {
      subtotal: "$0.00",
      offers: "$0.00",
      voucher: "$0.00",
      delivery: "$0.00",
      total: "$0.00",
    });
    await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
    await expect(page.getByTestId("checkout-blocked")).toHaveText("Add something to your basket to check out.");
  });

  test("Minus on loose produce removes 250 g and removes the line at 250 g", async ({ page }) => {
    // 1. Add tomatoes at 500 g, open /basket, click minus.
    await addProduct(page, "Vine tomatoes, loose", 1, "500 g");
    await page.goto("/basket");
    await expect(line(page, "Vine tomatoes, loose").getByTestId("line-weight")).toHaveText("500 g");
    await removeOne(page, "Vine tomatoes, loose");
    await expect(line(page, "Vine tomatoes, loose").getByTestId("line-weight")).toHaveText("250 g");
    await expect(line(page, "Vine tomatoes, loose").getByTestId("line-total")).toHaveText("$1.12");
    await expectTotals(page, { subtotal: "$1.12" });

    // 2. Click minus again.
    await removeOne(page, "Vine tomatoes, loose");
    await expect(page.getByTestId("basket-line")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Basket (0)" })).toBeVisible();
    await expectTotals(page, { subtotal: "$0.00" });
  });

  test("Loose produce line total rounds once at 250 g steps", async ({ page, request }) => {
    // 1. Add tomatoes at 250 g. Check line total.
    await addProduct(page, "Vine tomatoes, loose", 1, "250 g");
    await page.goto("/basket");
    await expect(line(page, "Vine tomatoes, loose").getByTestId("line-total")).toHaveText("$1.12");

    // 2. Add 250 g again (weight becomes 500 g).
    await addProduct(page, "Vine tomatoes, loose", 1, "250 g");
    await page.goto("/basket");
    await expect(line(page, "Vine tomatoes, loose").getByTestId("line-weight")).toHaveText("500 g");
    await expect(line(page, "Vine tomatoes, loose").getByTestId("line-total")).toHaveText("$2.25");

    // 3. In fresh baskets add Bananas 750 g, Bananas 1500 g and Gala apples 250 g.
    await startFresh(page, request);
    await addProduct(page, "Bananas, loose", 1, "750 g");
    await page.goto("/basket");
    await expect(line(page, "Bananas, loose").getByTestId("line-weight")).toHaveText("750 g");
    await expect(line(page, "Bananas, loose").getByTestId("line-total")).toHaveText("$1.04");

    await startFresh(page, request);
    await addProduct(page, "Bananas, loose", 1, "1500 g");
    await page.goto("/basket");
    await expect(line(page, "Bananas, loose").getByTestId("line-weight")).toHaveText("1500 g");
    await expect(line(page, "Bananas, loose").getByTestId("line-total")).toHaveText("$2.09");

    await startFresh(page, request);
    await addProduct(page, "Gala apples, loose", 1, "250 g");
    await page.goto("/basket");
    await expect(line(page, "Gala apples, loose").getByTestId("line-weight")).toHaveText("250 g");
    await expect(line(page, "Gala apples, loose").getByTestId("line-total")).toHaveText("$0.75");
  });

  test("Total is subtotal minus offers minus voucher plus delivery fee", async ({ page }) => {
    // 1. Book the 17:00 slot, add yoghurt x3 and sourdough x2, apply SAVE10.
    await bookSlot(page, SLOT_EVENING);
    await addProduct(page, "Natural yoghurt 500 g");
    await setQuantity(page, "Natural yoghurt 500 g", 3);
    await addProduct(page, "Sourdough loaf");
    await setQuantity(page, "Sourdough loaf", 2);
    await applyVoucher(page, "SAVE10");
    await expectTotals(page, {
      subtotal: "$10.97",
      offers: "-$1.49",
      voucher: "-$0.65",
      delivery: "$4.99",
      total: "$13.82",
    });
  });

  test("Total with no offer, no voucher and no slot equals the subtotal", async ({ page }) => {
    // 1. Add sourdough twice; no slot, no voucher.
    await addProduct(page, "Sourdough loaf", 2);
    await page.goto("/basket");
    await expectTotals(page, {
      subtotal: "$6.50",
      offers: "$0.00",
      voucher: "$0.00",
      delivery: "$0.00",
      total: "$6.50",
    });
  });

  test("Third unit of a 3 for 2 product is free", async ({ page }) => {
    // 1. Confirm the offer on /, add Greek yoghurt, Update quantity to 2.
    await page.goto("/");
    await expect(page.getByRole("article", { name: "Greek yoghurt 500 g", exact: true })).toContainText("3 for 2");
    await addProduct(page, "Greek yoghurt 500 g");
    await setQuantity(page, "Greek yoghurt 500 g", 2);
    await expect(page.getByTestId("line-total")).toHaveText("$4.58");
    await expectTotals(page, { offers: "$0.00" });
    await expect(page.getByText(/3 for 2: /)).toHaveCount(0);

    // 2. Update quantity to 3.
    await setQuantity(page, "Greek yoghurt 500 g", 3);
    await expect(page.getByText("3 for 2: -$2.29")).toBeVisible();
    await expectTotals(page, { offers: "-$2.29", total: "$4.58" });

    // 3. Update quantity to 5, then 6.
    await setQuantity(page, "Greek yoghurt 500 g", 5);
    await expectTotals(page, { offers: "-$2.29", total: "$9.16" });
    await setQuantity(page, "Greek yoghurt 500 g", 6);
    await expectTotals(page, { offers: "-$4.58", total: "$9.16" });
  });

  test("Different 3 for 2 products do not combine into a free unit", async ({ page }) => {
    // 1. Greek yoghurt x2 and Natural yoghurt x1.
    await addProduct(page, "Greek yoghurt 500 g");
    await setQuantity(page, "Greek yoghurt 500 g", 2);
    await addProduct(page, "Natural yoghurt 500 g");
    await page.goto("/basket");
    await expect(page.getByTestId("basket-line")).toHaveCount(2);
    await expectTotals(page, { offers: "$0.00", subtotal: "$6.07", total: "$6.07" });
    await expect(page.getByText(/3 for 2: /)).toHaveCount(0);
  });

  test("SAVE10 takes 10 percent off lines without an offer", async ({ page, request }) => {
    // 1. Sourdough x2, apply SAVE10.
    await addProduct(page, "Sourdough loaf");
    await setQuantity(page, "Sourdough loaf", 2);
    await expectTotals(page, { subtotal: "$6.50" });
    await applyVoucher(page, "SAVE10");
    await expectTotals(page, { voucher: "-$0.65", total: "$5.85" });

    // 2. Fresh basket: Sourdough x2 and tomatoes 500 g, apply SAVE10.
    await startFresh(page, request);
    await addProduct(page, "Sourdough loaf");
    await setQuantity(page, "Sourdough loaf", 2);
    await addProduct(page, "Vine tomatoes, loose", 1, "500 g");
    await applyVoucher(page, "SAVE10");
    await expectTotals(page, { subtotal: "$8.75", voucher: "-$0.88", total: "$7.87" });
  });

  test("SAVE10 never applies to a 3 for 2 line", async ({ page }) => {
    // 1. Natural yoghurt x3 only, apply SAVE10.
    await addProduct(page, "Natural yoghurt 500 g");
    await setQuantity(page, "Natural yoghurt 500 g", 3);
    await applyVoucher(page, "SAVE10");
    await expectTotals(page, { voucher: "$0.00", offers: "-$1.49", total: "$2.98" });

    // 2. Add Sourdough x2.
    await addProduct(page, "Sourdough loaf");
    await setQuantity(page, "Sourdough loaf", 2);
    await expectTotals(page, { voucher: "-$0.65", subtotal: "$10.97", total: "$8.83" });
  });

  test("Invalid voucher code is rejected", async ({ page }) => {
    // 1. Add sourdough once, apply BOGUS.
    await addProduct(page, "Sourdough loaf");
    await applyVoucher(page, "BOGUS");
    await expect(page.getByText("That voucher code is not valid.")).toBeVisible();
    await expectTotals(page, { voucher: "$0.00", total: "$3.25" });
  });

  test("Checkout is enabled at exactly 25.00 and disabled at 24.99", async ({ page, request }) => {
    // 1. Book the 08:00 slot; butter x3 and rice x6.
    await bookSlot(page, SLOT_MORNING);
    await addProduct(page, "Salted butter 250 g");
    await setQuantity(page, "Salted butter 250 g", 3);
    await addProduct(page, "Basmati rice 1 kg");
    await setQuantity(page, "Basmati rice 1 kg", 6);
    await expectTotals(page, { subtotal: "$24.99" });
    await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
    await expect(page.getByTestId("checkout-blocked")).toHaveText(
      "Spend $0.01 more to check out. The minimum order is $25.00.",
    );

    // 2. Reset, sign in, sourdough x7 plus tomatoes 500 g, book the same slot.
    await startFresh(page, request);
    await addProduct(page, "Sourdough loaf");
    await setQuantity(page, "Sourdough loaf", 7);
    await addProduct(page, "Vine tomatoes, loose", 1, "500 g");
    await bookSlot(page, SLOT_MORNING);
    await expectTotals(page, { subtotal: "$25.00", delivery: "$2.99", total: "$27.99" });
    await expect(page.getByRole("button", { name: "Checkout" })).toBeEnabled();
    await expect(page.getByText(/Spend \$/)).toHaveCount(0);
  });

  test("Checkout is disabled below 25.00 and shows how much more to spend", async ({ page }) => {
    // 1. Book a slot, sourdough x7.
    await bookSlot(page, SLOT_MORNING);
    await addProduct(page, "Sourdough loaf");
    await setQuantity(page, "Sourdough loaf", 7);
    await expectTotals(page, { subtotal: "$22.75" });
    await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
    await expect(page.getByTestId("checkout-blocked")).toHaveText(
      "Spend $2.25 more to check out. The minimum order is $25.00.",
    );

    // 2. Add tomatoes (500 g).
    await addProduct(page, "Vine tomatoes, loose", 1, "500 g");
    await page.goto("/basket");
    await expectTotals(page, { subtotal: "$25.00" });
    await expect(page.getByRole("button", { name: "Checkout" })).toBeEnabled();
  });

  test("Voucher can push the basket under the 25.00 minimum", async ({ page }) => {
    // 1. Book a slot; build the $25.00 basket; Checkout enabled; apply SAVE10.
    await bookSlot(page, SLOT_MORNING);
    await addProduct(page, "Sourdough loaf");
    await setQuantity(page, "Sourdough loaf", 7);
    await addProduct(page, "Vine tomatoes, loose", 1, "500 g");
    await page.goto("/basket");
    await expectTotals(page, { subtotal: "$25.00" });
    await expect(page.getByRole("button", { name: "Checkout" })).toBeEnabled();
    await applyVoucher(page, "SAVE10");
    // $22.50 after voucher plus $2.99 delivery
    await expectTotals(page, { voucher: "-$2.50", total: "$25.49" });
    await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
    await expect(page.getByTestId("checkout-blocked")).toHaveText(
      "Spend $2.50 more to check out. The minimum order is $25.00.",
    );
  });

  test("Minimum spend is measured after offers not before", async ({ page }) => {
    // 1. Book a slot; sourdough x5 and Greek yoghurt x6.
    await bookSlot(page, SLOT_MORNING);
    await addProduct(page, "Sourdough loaf");
    await setQuantity(page, "Sourdough loaf", 5);
    await addProduct(page, "Greek yoghurt 500 g");
    await setQuantity(page, "Greek yoghurt 500 g", 6);
    await expectTotals(page, { subtotal: "$29.99", offers: "-$4.58" });
    await expect(page.getByRole("button", { name: "Checkout" })).toBeEnabled();

    // 2. Update Greek yoghurt quantity to 3.
    await setQuantity(page, "Greek yoghurt 500 g", 3);
    await expectTotals(page, { subtotal: "$23.12", offers: "-$2.29" });
    await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
    await expect(page.getByTestId("checkout-blocked")).toHaveText(
      "Spend $4.17 more to check out. The minimum order is $25.00.",
    );

    // 3. Update sourdough to 6 with Greek yoghurt at 3.
    await setQuantity(page, "Sourdough loaf", 6);
    await expectTotals(page, { subtotal: "$26.37", offers: "-$2.29" });
    await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
    await expect(page.getByTestId("checkout-blocked")).toHaveText(
      "Spend $0.92 more to check out. The minimum order is $25.00.",
    );
  });

  test("Header shows the number of lines not units", async ({ page }) => {
    // 1. Check the header link on the seed basket.
    await expect(page.getByRole("link", { name: "Basket (0)" })).toBeVisible();

    // 2. Sourdough x3, Penne, Carrots 500 g.
    await addProduct(page, "Sourdough loaf", 3);
    await addProduct(page, "Penne 500 g");
    await addProduct(page, "Carrots, loose", 1, "500 g");
    await page.goto("/basket");
    await expect(page.getByTestId("basket-line")).toHaveCount(3);
    await expect(page.getByRole("link", { name: "Basket (3)" })).toBeVisible();

    // 3. Click 'Remove Penne 500 g'.
    await submit(page, () => page.getByRole("button", { name: "Remove Penne 500 g", exact: true }).click());
    await expect(page.getByTestId("basket-line")).toHaveCount(2);
    await expect(page.getByRole("link", { name: "Basket (2)" })).toBeVisible();
  });
});
