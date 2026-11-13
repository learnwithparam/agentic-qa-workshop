// spec: specs/basket.md
// seed: tests/seed.spec.ts
import { expect, type Page, test } from "@playwright/test";

async function start(page: Page, request: import("@playwright/test").APIRequestContext) {
  await request.post("/__test/reset");
  await page.goto("/signin");
  await page.getByLabel("Email").fill("ana@pantryrun.test");
  await page.getByLabel("Password").fill("pantry");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/basket");
  await expect(page.getByRole("heading", { name: "Your basket" })).toBeVisible();
  await expect(page.getByTestId("empty-basket")).toBeVisible();
}

async function add(page: Page, name: string, weight?: string) {
  await page.goto("/");
  const card = page.getByRole("article", { name });
  if (weight) await card.getByLabel(`Weight of ${name}`).selectOption({ label: weight });
  await card.getByRole("button", { name: "Add" }).click();
  await page.waitForURL(/added=/);
}

async function bookSlot(page: Page) {
  await page.goto("/slots");
  await page.getByRole("button", { name: "Choose a delivery time" }).click();
  const dialog = page.getByRole("dialog", { name: "Choose a delivery time" });
  await dialog.getByRole("radio", { name: /Wed, Mar 11 08:00/ }).check();
  await dialog.getByRole("button", { name: "Reserve" }).click();
  await page.waitForURL(/booked=/);
}

const row = (page: Page, name: string) => page.getByTestId("basket-line").filter({ hasText: name });

async function setQty(page: Page, name: string, qty: number) {
  await page.getByLabel(`Quantity of ${name}`).fill(String(qty));
  await page.getByRole("button", { name: `Update ${name}` }).click();
}

async function applyVoucher(page: Page, code: string) {
  await page.getByLabel("Voucher code").fill(code);
  await page.getByRole("button", { name: "Apply" }).click();
}

const header = (page: Page, lineCount: number) =>
  page.getByRole("link", { name: `Basket (${lineCount})` });

test.beforeEach(async ({ page, request }) => {
  await start(page, request);
});

test("Adding the same item again raises the quantity", async ({ page }) => {
  // 1. Add Avocados, open /basket
  await add(page, "Avocados, pack of 2");
  await page.goto("/basket");
  await expect(page.getByTestId("basket-line")).toHaveCount(1);
  await expect(page.getByLabel("Quantity of Avocados, pack of 2")).toHaveValue("1");
  await expect(row(page, "Avocados, pack of 2").getByTestId("line-total")).toHaveText("$3.49");
  await expect(header(page, 1)).toBeVisible();

  // 2. Add again
  await add(page, "Avocados, pack of 2");
  await page.goto("/basket");
  await expect(page.getByTestId("basket-line")).toHaveCount(1);
  await expect(page.getByLabel("Quantity of Avocados, pack of 2")).toHaveValue("2");
  await expect(row(page, "Avocados, pack of 2").getByTestId("line-total")).toHaveText("$6.98");
  await expect(page.getByTestId("subtotal")).toHaveText("$6.98");
  await expect(header(page, 1)).toBeVisible();
});

test("Adding loose produce twice raises the weight", async ({ page }) => {
  // 1. Add Bananas at 500 g twice
  await add(page, "Bananas, loose");
  await add(page, "Bananas, loose");
  await page.goto("/basket");
  await expect(page.getByTestId("basket-line")).toHaveCount(1);
  await expect(row(page, "Bananas, loose").getByTestId("line-weight")).toHaveText("1 kg");
  await expect(row(page, "Bananas, loose").getByTestId("line-total")).toHaveText("$1.39");
  await expect(page.getByTestId("subtotal")).toHaveText("$1.39");
});

test("Quantity box and Update change a line", async ({ page }) => {
  // 1. Add butter, fill 4 without Update
  await add(page, "Salted butter 250 g");
  await page.goto("/basket");
  await page.getByLabel("Quantity of Salted butter 250 g").fill("4");
  await expect(row(page, "Salted butter 250 g").getByTestId("line-total")).toHaveText("$2.35");

  // 2. Click Update
  await page.getByRole("button", { name: "Update Salted butter 250 g" }).click();
  await expect(page.getByLabel("Quantity of Salted butter 250 g")).toHaveValue("4");
  await expect(row(page, "Salted butter 250 g").getByTestId("line-total")).toHaveText("$9.40");
  await expect(page.getByTestId("subtotal")).toHaveText("$9.40");
  await expect(page.getByTestId("total")).toHaveText("$9.40");
});

test("Update rejects a quantity outside 1 to 20", async ({ page }) => {
  await add(page, "Salted butter 250 g");
  await page.goto("/basket");
  const total = row(page, "Salted butter 250 g").getByTestId("line-total");

  // 1. Quantity 0
  await setQty(page, "Salted butter 250 g", 0);
  await expect(page.getByText("Quantity must be from 1 to 20.")).toBeVisible();
  await expect(total).toHaveText("$2.35");

  // 2. Quantity 21
  await setQty(page, "Salted butter 250 g", 21);
  await expect(page.getByText("Quantity must be from 1 to 20.")).toBeVisible();
  await expect(total).toHaveText("$2.35");
  await expect(page.getByLabel("Quantity of Salted butter 250 g")).not.toHaveValue("21");

  // 3. Quantity 20
  await setQty(page, "Salted butter 250 g", 20);
  await expect(total).toHaveText("$47.00");
  await expect(page.getByText("Quantity must be from 1 to 20.")).toHaveCount(0);
});

test("Minus lowers a unit line by one and the last unit removes the line", async ({ page }) => {
  await add(page, "Avocados, pack of 2");
  await page.goto("/basket");
  await setQty(page, "Avocados, pack of 2", 2);
  await expect(page.getByLabel("Quantity of Avocados, pack of 2")).toHaveValue("2");

  // 1. Minus once
  await page.getByRole("button", { name: "Remove one Avocados, pack of 2" }).click();
  await expect(page.getByLabel("Quantity of Avocados, pack of 2")).toHaveValue("1");
  await expect(row(page, "Avocados, pack of 2").getByTestId("line-total")).toHaveText("$3.49");
  await expect(page.getByTestId("subtotal")).toHaveText("$3.49");

  // 2. Minus again removes the line
  await page.getByRole("button", { name: "Remove one Avocados, pack of 2" }).click();
  await expect(page.getByTestId("basket-line")).toHaveCount(0);
  await expect(page.getByText("Your basket is empty.")).toBeVisible();
  await expect(header(page, 0)).toBeVisible();
  await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
});

test("Minus lowers loose produce by 250 g and removes the line at the last step", async ({
  page,
}) => {
  await add(page, "Bananas, loose", "1 kg");
  await page.goto("/basket");
  const weight = row(page, "Bananas, loose").getByTestId("line-weight");
  const total = row(page, "Bananas, loose").getByTestId("line-total");
  const minus = page.getByRole("button", { name: "Remove one Bananas, loose" });

  // 1. Minus once
  await minus.click();
  await expect(weight).toHaveText("750 g");
  await expect(total).toHaveText("$1.04");

  // 2. Minus three more times
  await minus.click();
  await expect(weight).toHaveText("500 g");
  await expect(total).toHaveText("$0.70");
  await minus.click();
  await expect(weight).toHaveText("250 g");
  await expect(total).toHaveText("$0.35");
  await minus.click();
  await expect(page.getByTestId("basket-line")).toHaveCount(0);
  await expect(page.getByText("Your basket is empty.")).toBeVisible();
});

test("Loose produce line totals are rounded once to the cent", async ({ page, request }) => {
  const cases = [
    { name: "Bananas, loose", weight: "1500 g", price: "$2.09" },
    { name: "Gala apples, loose", weight: "1500 g", price: "$4.49" },
    { name: "Vine tomatoes, loose", weight: "750 g", price: "$3.37" },
    { name: "Vine tomatoes, loose", weight: "250 g", price: "$1.12" },
    { name: "Carrots, loose", weight: "750 g", price: "$0.74" },
  ];
  for (const looseItem of cases) {
    // 1. Fresh start per case
    await start(page, request);
    await add(page, looseItem.name, looseItem.weight);
    await page.goto("/basket");
    await expect(row(page, looseItem.name).getByTestId("line-total")).toHaveText(looseItem.price);
    await expect(page.getByTestId("subtotal")).toHaveText(looseItem.price);
  }
});

test("Loose produce offers only 250 g steps", async ({ page }) => {
  // 1. Read the weight options
  await page.goto("/");
  const select = page.getByLabel("Weight of Vine tomatoes, loose");
  await expect(select.getByRole("option")).toHaveText([
    "250 g",
    "500 g",
    "750 g",
    "1 kg",
    "1500 g",
    "2 kg",
  ]);
  await expect(page.getByRole("textbox", { name: "Weight of Vine tomatoes, loose" })).toHaveCount(
    0,
  );

  // 2. Add 2 kg
  await add(page, "Vine tomatoes, loose", "2 kg");
  await page.goto("/basket");
  const line = row(page, "Vine tomatoes, loose");
  await expect(line.getByTestId("line-weight")).toHaveText("2 kg");
  await expect(line.getByTestId("line-total")).toHaveText("$8.98");
  await expect(line.getByRole("spinbutton")).toHaveCount(0);
  await expect(line.getByRole("button", { name: "Remove one Vine tomatoes, loose" })).toBeVisible();
  await expect(
    line.getByRole("button", { name: "Remove Vine tomatoes, loose", exact: true }),
  ).toBeVisible();
});

test("Total is subtotal minus offers minus voucher plus delivery", async ({ page }) => {
  // 1. Build basket, book slot, apply SAVE10
  for (let i = 0; i < 3; i++) await add(page, "Natural yoghurt 500 g");
  await add(page, "Bananas, loose");
  await add(page, "Bananas, loose");
  await add(page, "Avocados, pack of 2");
  await bookSlot(page);
  await page.goto("/basket");
  await applyVoucher(page, "SAVE10");
  await expect(page.getByTestId("subtotal")).toHaveText("$9.35");
  await expect(page.getByTestId("offers")).toHaveText("-$1.49");
  await expect(page.getByTestId("voucher")).toHaveText("-$0.49");
  await expect(page.getByTestId("delivery")).toHaveText("$2.99");
  await expect(page.getByTestId("total")).toHaveText("$10.36");
});

test("Delivery fee is added to the total only once a slot is booked", async ({ page }) => {
  // 1. No slot
  await add(page, "Avocados, pack of 2");
  await page.goto("/basket");
  await expect(page.getByText("No delivery slot booked.")).toBeVisible();
  await expect(page.getByTestId("delivery")).toHaveText("$0.00");
  await expect(page.getByTestId("total")).toHaveText("$3.49");

  // 2. Book slot
  await bookSlot(page);
  await page.goto("/basket");
  await expect(page.getByTestId("delivery")).toHaveText("$2.99");
  await expect(page.getByTestId("total")).toHaveText("$6.48");
});

test("3 for 2: every third unit of the same product is free", async ({ page }) => {
  const name = "Natural yoghurt 500 g";
  await add(page, name);
  await page.goto("/basket");
  const total = row(page, name).getByTestId("line-total");

  // 1. Quantity 2
  await setQty(page, name, 2);
  await expect(total).toHaveText("$2.98");
  await expect(page.getByTestId("offers")).toHaveText("$0.00");
  await expect(page.getByText(/3 for 2/)).toHaveCount(0);

  // 2. Quantity 3
  await setQty(page, name, 3);
  await expect(total).toHaveText("$4.47");
  await expect(row(page, name).getByText("3 for 2: -$1.49")).toBeVisible();
  await expect(page.getByTestId("offers")).toHaveText("-$1.49");
  await expect(page.getByTestId("total")).toHaveText("$2.98");

  // 3. Quantity 5 then 6
  await setQty(page, name, 5);
  await expect(page.getByTestId("subtotal")).toHaveText("$7.45");
  await expect(page.getByTestId("offers")).toHaveText("-$1.49");
  await setQty(page, name, 6);
  await expect(page.getByTestId("subtotal")).toHaveText("$8.94");
  await expect(page.getByTestId("offers")).toHaveText("-$2.98");
  await expect(page.getByTestId("total")).toHaveText("$5.96");
});

test("3 for 2 does not mix different products", async ({ page }) => {
  await add(page, "Natural yoghurt 500 g");
  await add(page, "Natural yoghurt 500 g");
  await add(page, "Greek yoghurt 500 g");
  await page.goto("/basket");
  await expect(page.getByTestId("subtotal")).toHaveText("$5.27");
  await expect(page.getByTestId("offers")).toHaveText("$0.00");
  await expect(page.getByTestId("total")).toHaveText("$5.27");
});

test("SAVE10 takes 10% off lines without a multi-buy offer", async ({ page }) => {
  await add(page, "Extra mature farmhouse cheddar 400 g");
  await add(page, "Salted butter 250 g");
  await page.goto("/basket");
  await setQty(page, "Extra mature farmhouse cheddar 400 g", 4);
  await expect(page.getByLabel("Quantity of Extra mature farmhouse cheddar 400 g")).toHaveValue(
    "4",
  );
  await setQty(page, "Salted butter 250 g", 3);
  await expect(page.getByLabel("Quantity of Salted butter 250 g")).toHaveValue("3");
  await applyVoucher(page, "SAVE10");
  await expect(page.getByTestId("subtotal")).toHaveText("$24.05");
  await expect(page.getByTestId("voucher")).toHaveText("-$2.41");
  await expect(page.getByTestId("total")).toHaveText("$21.64");
});

test("SAVE10 never applies to a 3 for 2 line", async ({ page }) => {
  // 1. Greek yoghurt x5
  await add(page, "Greek yoghurt 500 g");
  await page.goto("/basket");
  await setQty(page, "Greek yoghurt 500 g", 5);
  await expect(page.getByLabel("Quantity of Greek yoghurt 500 g")).toHaveValue("5");
  await applyVoucher(page, "SAVE10");
  await expect(page.getByTestId("subtotal")).toHaveText("$11.45");
  await expect(page.getByTestId("offers")).toHaveText("-$2.29");
  await expect(page.getByTestId("voucher")).toHaveText("$0.00");
  await expect(page.getByTestId("total")).toHaveText("$9.16");

  // 2. Add avocados
  await add(page, "Avocados, pack of 2");
  await page.goto("/basket");
  await expect(page.getByTestId("voucher")).toHaveText("-$0.35");
  await expect(page.getByTestId("total")).toHaveText("$12.30");
});

test("Invalid voucher code is rejected", async ({ page }) => {
  await add(page, "Avocados, pack of 2");
  await page.goto("/basket");
  await applyVoucher(page, "NOPE10");
  await expect(page.getByTestId("voucher")).toHaveText("$0.00");
  await expect(page.getByTestId("total")).toHaveText("$3.49");
  await expect(page.getByText(/applied|accepted/i)).toHaveCount(0);
});

test("Checkout enabled at exactly $25.00 and disabled at $24.05 or less", async ({ page }) => {
  // 1. Slot, then basket of exactly $25.00
  await bookSlot(page);
  await add(page, "Salted butter 250 g");
  await add(page, "Extra mature farmhouse cheddar 400 g");
  await add(page, "Penne 500 g");
  await page.goto("/basket");
  await setQty(page, "Salted butter 250 g", 3);
  await expect(page.getByLabel("Quantity of Salted butter 250 g")).toHaveValue("3");
  await setQty(page, "Extra mature farmhouse cheddar 400 g", 4);
  await expect(page.getByLabel("Quantity of Extra mature farmhouse cheddar 400 g")).toHaveValue(
    "4",
  );
  await expect(page.getByTestId("subtotal")).toHaveText("$25.00");
  await expect(page.getByTestId("offers")).toHaveText("$0.00");
  await expect(page.getByTestId("voucher")).toHaveText("$0.00");
  await expect(page.getByTestId("delivery")).toHaveText("$2.99");
  await expect(page.getByTestId("total")).toHaveText("$27.99");
  await expect(page.getByRole("button", { name: "Checkout" })).toBeEnabled();
  await expect(page.getByText(/Spend .* more/)).toHaveCount(0);

  // 2. Remove Penne
  await page.getByRole("button", { name: "Remove one Penne 500 g" }).click();
  await expect(page.getByTestId("subtotal")).toHaveText("$24.05");
  await expect(page.getByTestId("total")).toHaveText("$27.04");
  await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
  await expect(
    page.getByText("Spend $0.95 more to check out. The minimum order is $25.00."),
  ).toBeVisible();
});

test("Checkout disabled with the exact shortfall below the $25.00 minimum", async ({ page }) => {
  // 1. Subtotal $24.99
  await add(page, "Ground coffee 227 g");
  await add(page, "Extra mature farmhouse cheddar 400 g");
  await add(page, "Sourdough");
  await bookSlot(page);
  await page.goto("/basket");
  await setQty(page, "Sourdough", 5);
  await expect(page.getByLabel("Quantity of Sourdough")).toHaveValue("5");
  await expect(page.getByTestId("subtotal")).toHaveText("$24.99");
  await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
  await expect(
    page.getByText("Spend $0.01 more to check out. The minimum order is $25.00."),
  ).toBeVisible();

  // 2. Sourdough 6
  await setQty(page, "Sourdough", 6);
  await expect(page.getByTestId("subtotal")).toHaveText("$28.24");
  await expect(page.getByRole("button", { name: "Checkout" })).toBeEnabled();
  await expect(page.getByText(/Spend .* more/)).toHaveCount(0);
});

test("Minimum is checked after offers and voucher", async ({ page }) => {
  // 1. $25.00 basket with slot
  await bookSlot(page);
  await add(page, "Extra mature farmhouse cheddar 400 g");
  await add(page, "Salted butter 250 g");
  await add(page, "Penne 500 g");
  await page.goto("/basket");
  await setQty(page, "Extra mature farmhouse cheddar 400 g", 4);
  await expect(page.getByLabel("Quantity of Extra mature farmhouse cheddar 400 g")).toHaveValue(
    "4",
  );
  await setQty(page, "Salted butter 250 g", 3);
  await expect(page.getByLabel("Quantity of Salted butter 250 g")).toHaveValue("3");
  await expect(page.getByTestId("subtotal")).toHaveText("$25.00");
  await expect(page.getByRole("button", { name: "Checkout" })).toBeEnabled();

  // 2. Apply SAVE10
  await applyVoucher(page, "SAVE10");
  await expect(page.getByTestId("voucher")).toHaveText("-$2.50");
  await expect(page.getByTestId("total")).toHaveText("$25.49");
  await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
  await expect(
    page.getByText("Spend $2.50 more to check out. The minimum order is $25.00."),
  ).toBeVisible();
});

test("3 for 2 offer can drop the basket below the minimum", async ({ page }) => {
  await bookSlot(page);
  await add(page, "Extra mature farmhouse cheddar 400 g");
  await add(page, "Natural yoghurt 500 g");
  await add(page, "Salted butter 250 g");
  await page.goto("/basket");
  await setQty(page, "Extra mature farmhouse cheddar 400 g", 4);
  await expect(page.getByLabel("Quantity of Extra mature farmhouse cheddar 400 g")).toHaveValue(
    "4",
  );
  await setQty(page, "Natural yoghurt 500 g", 3);
  await expect(page.getByLabel("Quantity of Natural yoghurt 500 g")).toHaveValue("3");
  await setQty(page, "Salted butter 250 g", 2);
  await expect(page.getByLabel("Quantity of Salted butter 250 g")).toHaveValue("2");
  await expect(page.getByTestId("subtotal")).toHaveText("$26.17");
  await expect(page.getByTestId("offers")).toHaveText("-$1.49");
  await expect(page.getByTestId("total")).toHaveText("$27.67");
  await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
  await expect(
    page.getByText("Spend $0.32 more to check out. The minimum order is $25.00."),
  ).toBeVisible();
});

test("Checkout is disabled for an empty basket", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
  await expect(page.getByText("Add something to your basket to check out.")).toBeVisible();
  for (const id of ["subtotal", "offers", "voucher", "delivery", "total"]) {
    await expect(page.getByTestId(id)).toHaveText("$0.00");
  }
  await expect(header(page, 0)).toBeVisible();
});

test("Header counts lines, not units", async ({ page }) => {
  // 1. Six adds, three lines
  for (let i = 0; i < 3; i++) await add(page, "Natural yoghurt 500 g");
  await add(page, "Bananas, loose");
  await add(page, "Bananas, loose");
  await add(page, "Avocados, pack of 2");
  await expect(header(page, 3)).toBeVisible();

  // 2. Remove Bananas
  await page.goto("/basket");
  await page.getByRole("button", { name: "Remove Bananas, loose", exact: true }).click();
  await expect(page.getByTestId("basket-line")).toHaveCount(2);
  await expect(header(page, 2)).toBeVisible();

  // 3. Avocados to 5
  await setQty(page, "Avocados, pack of 2", 5);
  await expect(page.getByLabel("Quantity of Avocados, pack of 2")).toHaveValue("5");
  await expect(header(page, 2)).toBeVisible();

  // 4. Remove the rest
  await page.getByRole("button", { name: "Remove Avocados, pack of 2", exact: true }).click();
  await page.getByRole("button", { name: "Remove Natural yoghurt 500 g", exact: true }).click();
  await expect(page.getByTestId("basket-line")).toHaveCount(0);
  await expect(header(page, 0)).toBeVisible();
});
