// spec: specs/slots.md
// seed: tests/seed.spec.ts
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const DEFAULT_CLOCK = "2026-03-10T12:00:00-05:00";
const CHEDDAR = "Extra mature farmhouse cheddar 400 g";

async function resetShop(request: APIRequestContext, at: string = DEFAULT_CLOCK) {
  await request.post("/__test/reset");
  await request.post("/__test/clock", { data: { at } });
}

async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("ana@pantryrun.test");
  await page.getByLabel("Password").fill("pantry");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/basket");
  await expect(page.getByRole("heading", { name: "Your basket" })).toBeVisible();
}

async function buildBasketOver25(page: Page) {
  await page.goto("/");
  await page
    .getByRole("article", { name: CHEDDAR })
    .getByRole("button", { name: "Add" })
    .click();
  await page.goto("/basket");
  await page.getByLabel(`Quantity of ${CHEDDAR}`).fill("6");
  await page.getByRole("button", { name: `Update ${CHEDDAR}` }).click();
  await expect(page.getByTestId("subtotal")).toHaveText("$25.50");
}

async function bookSlot(page: Page, name: string | RegExp) {
  await page.goto("/slots");
  await page.getByRole("radio", { name }).check();
  await page.getByRole("button", { name: "Book slot" }).click();
  await expect(page.getByRole("status")).toHaveText("Slot booked");
}

test.describe("Delivery slots", () => {
  test("Slot picker lists 08:00 to 19:00 slots for three dates", async ({ page, request }) => {
    await resetShop(request);
    await signIn(page);

    // 1. Start from the seed, then click the "Delivery slots" header link.
    await page.getByRole("link", { name: "Delivery slots" }).click();

    // 2. Read the date groups and their slot radios.
    await expect(page.getByRole("heading", { name: "Choose a delivery slot" })).toBeVisible();
    const dates = ["Wed, Mar 11", "Thu, Mar 12", "Fri, Mar 13"];
    for (const date of dates) {
      const group = page.getByRole("group", { name: date });
      await expect(group.getByRole("radio")).toHaveCount(12);
      await expect(group.getByRole("radio").first()).toHaveAccessibleName(
        new RegExp(`^${date} 08:00 to 09:00`),
      );
      await expect(group.getByRole("radio").last()).toHaveAccessibleName(
        new RegExp(`^${date} 19:00 to 20:00`),
      );
      await expect(group.getByRole("radio", { name: /07:00 to 08:00/ })).toHaveCount(0);
      await expect(group.getByRole("radio", { name: /20:00 to 21:00/ })).toHaveCount(0);
    }
    await expect(page.getByRole("group")).toHaveCount(3);
  });

  test("Booking a slot shows date, time and fee in the basket", async ({ page, request }) => {
    await resetShop(request);
    await signIn(page);

    // 1. Open /slots and check "Fri, Mar 13 10:00 to 11:00, $2.99".
    await page.goto("/slots");
    await page.getByRole("radio", { name: "Fri, Mar 13 10:00 to 11:00, $2.99" }).check();

    // 2. Click "Book slot".
    await page.getByRole("button", { name: "Book slot" }).click();

    await expect(page).toHaveURL(/\/basket/);
    await expect(page.getByRole("status")).toHaveText("Slot booked");
    await expect(page.getByText("Fri, Mar 13, 10:00 to 11:00 ($2.99)")).toBeVisible();
    await expect(page.getByTestId("delivery")).toHaveText("$2.99");
  });

  test("17:00 and 18:00 slots cost $4.99, 16:00 and 19:00 cost $2.99", async ({ page, request }) => {
    await resetShop(request);
    await signIn(page);

    // 1. Open /slots and read the Fri, Mar 13 radios.
    await page.goto("/slots");
    const friday = page.getByRole("group", { name: "Fri, Mar 13" });
    for (let hour = 8; hour <= 16; hour++) {
      const start = String(hour).padStart(2, "0");
      await expect(friday.getByRole("radio", { name: new RegExp(`^Fri, Mar 13 ${start}:00 to .*, \\$2\\.99$`) })).toHaveCount(1);
    }
    await expect(friday.getByRole("radio", { name: /^Fri, Mar 13 17:00 to 18:00, \$4\.99$/ })).toHaveCount(1);
    await expect(friday.getByRole("radio", { name: /^Fri, Mar 13 18:00 to 19:00, \$4\.99$/ })).toHaveCount(1);
    await expect(friday.getByRole("radio", { name: /^Fri, Mar 13 19:00 to 20:00, \$2\.99$/ })).toHaveCount(1);

    // 2. Book Fri 16:00 and read the basket Delivery row.
    await bookSlot(page, "Fri, Mar 13 16:00 to 17:00, $2.99");
    await expect(page.getByTestId("delivery")).toHaveText("$2.99");

    // 3. Book Fri 17:00 and read the row.
    await bookSlot(page, "Fri, Mar 13 17:00 to 18:00, $4.99");
    await expect(page.getByTestId("delivery")).toHaveText("$4.99");

    // 4. Book Fri 18:00 and read the row.
    await bookSlot(page, "Fri, Mar 13 18:00 to 19:00, $4.99");
    await expect(page.getByTestId("delivery")).toHaveText("$4.99");

    // 5. Book Fri 19:00 and read the row.
    await bookSlot(page, "Fri, Mar 13 19:00 to 20:00, $2.99");
    await expect(page.getByTestId("delivery")).toHaveText("$2.99");
  });

  test("Slots with 3 or fewer places left show N left", async ({ page, request }) => {
    await resetShop(request);
    await signIn(page);

    // 1. Open /slots.
    await page.goto("/slots");

    // 2. Read the radios for Wed 10:00, Wed 17:00 and Thu 10:00.
    const wed10 = page.getByRole("radio", { name: "Wed, Mar 11 10:00 to 11:00, $2.99, 3 left" });
    const wed17 = page.getByRole("radio", { name: "Wed, Mar 11 17:00 to 18:00, $4.99, 1 left" });
    await expect(wed10).toBeEnabled();
    await expect(wed17).toBeEnabled();
    await expect(page.getByRole("radio", { name: "Thu, Mar 12 10:00 to 11:00, $2.99", exact: true })).toBeVisible();
    await expect(page.getByRole("group", { name: "Thu, Mar 12" }).getByRole("radio", { name: /10:00 to 11:00.*left/ })).toHaveCount(0);

    // 3. Place one order in Wed 10:00 using the $25+ helper, book that slot and click Checkout.
    await buildBasketOver25(page);
    await bookSlot(page, "Wed, Mar 11 10:00 to 11:00, $2.99, 3 left");
    await page.getByRole("button", { name: "Checkout" }).click();
    await expect(page.getByRole("heading", { name: "Order PR-1001 placed" })).toBeVisible();

    // Open /slots again.
    await page.goto("/slots");
    await expect(page.getByRole("radio", { name: "Wed, Mar 11 10:00 to 11:00, $2.99, 2 left" })).toBeEnabled();
  });

  test("The 20th order fills a slot, which shows Full and cannot be booked", async ({ page, request }) => {
    await resetShop(request);
    await signIn(page);

    // 1. Build a $25.50 basket with the helper.
    await buildBasketOver25(page);

    // 2. Book "Wed, Mar 11 17:00 to 18:00, $4.99, 1 left".
    await bookSlot(page, "Wed, Mar 11 17:00 to 18:00, $4.99, 1 left");

    // 3. Click Checkout.
    await page.getByRole("button", { name: "Checkout" }).click();
    await expect(page.getByRole("heading", { name: "Order PR-1001 placed" })).toBeVisible();

    // 4. Open /slots.
    await page.goto("/slots");
    const full = page.getByRole("radio", { name: "Wed, Mar 11 17:00 to 18:00, $4.99, Full" });
    await expect(full).toBeVisible();
    await expect(full).toBeDisabled();
  });

  test("Seeded Full slots show Full and cannot be selected", async ({ page, request }) => {
    await resetShop(request);
    await signIn(page);

    // 1. Open /slots.
    await page.goto("/slots");

    // 2. Read the radios for Wed 18:00 and Thu 18:00.
    for (const name of [
      "Wed, Mar 11 18:00 to 19:00, $4.99, Full",
      "Thu, Mar 12 18:00 to 19:00, $4.99, Full",
    ]) {
      const radio = page.getByRole("radio", { name });
      await expect(radio).toBeVisible();
      await expect(radio).toBeDisabled();
    }

    // 3. Open /basket.
    await page.goto("/basket");
    await expect(page.getByText("No delivery slot booked.")).toBeVisible();
  });

  test("Next-day slots still open at 21:59", async ({ page, request }) => {
    await resetShop(request, "2026-03-10T21:59:00-05:00");
    await signIn(page);

    // 1-2. Clock is set to 21:59; open /slots.
    await page.goto("/slots");
    await expect(page.getByRole("group", { name: "Wed, Mar 11" }).getByRole("radio")).toHaveCount(12);
    await expect(page.getByRole("radio", { name: /Closed$/ })).toHaveCount(0);

    // 3. Book "Wed, Mar 11 08:00 to 09:00, $2.99".
    await page.getByRole("radio", { name: "Wed, Mar 11 08:00 to 09:00, $2.99" }).check();
    await page.getByRole("button", { name: "Book slot" }).click();

    await expect(page.getByRole("status")).toHaveText("Slot booked");
    await expect(page.getByText("Wed, Mar 11, 08:00 to 09:00 ($2.99)")).toBeVisible();
  });

  test("Next-day slots Closed at 22:00 and after", async ({ page, request }) => {
    await resetShop(request, "2026-03-10T22:00:00-05:00");
    await signIn(page);

    // 1-2. Clock is set to 22:00; open /slots.
    await page.goto("/slots");

    const wed = page.getByRole("group", { name: "Wed, Mar 11" }).getByRole("radio");
    await expect(wed).toHaveCount(12);
    for (const radio of await wed.all()) {
      await expect(radio).toHaveAccessibleName(/, Closed$/);
      await expect(radio).toBeDisabled();
    }

    await expect(page.getByRole("group", { name: "Thu, Mar 12" }).getByRole("radio", { name: /Closed$/ })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Fri, Mar 13" }).getByRole("radio", { name: /Closed$/ })).toHaveCount(0);

    await page.getByRole("radio", { name: "Thu, Mar 12 10:00 to 11:00, $2.99" }).check();
    await page.getByRole("button", { name: "Book slot" }).click();
    await expect(page.getByRole("status")).toHaveText("Slot booked");
    await expect(page.getByText("Thu, Mar 12, 10:00 to 11:00 ($2.99)")).toBeVisible();
  });

  test("Cannot check out without a booked slot", async ({ page, request }) => {
    await resetShop(request);
    await signIn(page);

    // 1. Build a $25.50 basket with the helper. Do not book a slot.
    await buildBasketOver25(page);

    // 2. Read the basket.
    await expect(page.getByText("No delivery slot booked.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Choose a slot" })).toBeVisible();
    await expect(page.getByText("Book a delivery slot to check out.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();

    // 3. Book any slot and return to the basket.
    await bookSlot(page, "Thu, Mar 12 10:00 to 11:00, $2.99");
    await expect(page.getByText("Book a delivery slot to check out.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Checkout" })).toBeEnabled();
  });

  test("Times are store time whatever the browser time zone", async ({ browser, request }, testInfo) => {
    await resetShop(request);
    const baseURL = testInfo.project.use.baseURL;
    const context = await browser.newContext({ timezoneId: "Pacific/Auckland", baseURL });
    try {
      const page = await context.newPage();

      // 1. Create a browser context with timezoneId "Pacific/Auckland" and sign in as Ana.
      await signIn(page);

      // 2. Open /slots and read the groups and radios.
      await page.goto("/slots");
      await expect(page.getByRole("group")).toHaveCount(3);
      for (const date of ["Wed, Mar 11", "Thu, Mar 12", "Fri, Mar 13"]) {
        const group = page.getByRole("group", { name: date });
        await expect(group.getByRole("radio")).toHaveCount(12);
        await expect(group.getByRole("radio").first()).toHaveAccessibleName(new RegExp(`^${date} 08:00 to 09:00`));
        await expect(group.getByRole("radio").last()).toHaveAccessibleName(new RegExp(`^${date} 19:00 to 20:00`));
      }

      // 3. Book "Thu, Mar 12 17:00 to 18:00, $4.99".
      await page.getByRole("radio", { name: "Thu, Mar 12 17:00 to 18:00, $4.99" }).check();
      await page.getByRole("button", { name: "Book slot" }).click();

      // 4. Read Delivery on /basket.
      await expect(page.getByRole("status")).toHaveText("Slot booked");
      await expect(page.getByText("Thu, Mar 12, 17:00 to 18:00 ($4.99)")).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
