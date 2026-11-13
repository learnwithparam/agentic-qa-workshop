// spec: specs/slots.md
// seed: tests/seed.spec.ts
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

async function startFromSeed(page: Page, request: APIRequestContext) {
  await request.post("/__test/reset");
  await page.goto("/signin");
  await page.getByLabel("Email").fill("ana@pantryrun.test");
  await page.getByLabel("Password").fill("pantry");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/basket");
  await expect(page.getByRole("heading", { name: "Your basket" })).toBeVisible();
  await expect(page.getByText("No delivery slot booked.")).toBeVisible();
}

async function setClock(request: APIRequestContext, at: string) {
  const response = await request.post("/__test/clock", { data: { at } });
  expect(response.ok()).toBe(true);
}

function slotRadio(page: Page, label: string) {
  return page.getByRole("radio", { name: label });
}

async function bookSlot(page: Page, label: string) {
  await page.goto("/slots");
  await slotRadio(page, label).check();
  await page.getByRole("button", { name: "Book slot" }).click();
  await expect(page.getByText("Slot booked").first()).toBeVisible();
}

async function buildTwentyFiveDollarBasket(page: Page) {
  // 7 x Sourdough loaf ($22.75) + Vine tomatoes, loose at the default 500 g ($2.25) = $25.00.
  const adds = [...Array(7).fill("Sourdough loaf"), "Vine tomatoes, loose"];
  for (const name of adds) {
    await page.goto("/");
    await page.getByRole("article", { name, exact: true }).getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("status")).toContainText(`Added ${name}`);
  }
  // The header counts lines, not units.
  await expect(page.getByRole("link", { name: "Basket (2)" })).toBeVisible();
}

const days = ["Wed, Mar 11", "Thu, Mar 12", "Fri, Mar 13"];

test.describe("Delivery slots", () => {
  test("Slot picker lists one-hour slots 08:00 to 19:00 for three delivery dates", async ({ page, request }) => {
    await startFromSeed(page, request);

    // 1. Click the 'Delivery slots' link in the header.
    await page.getByRole("link", { name: "Delivery slots" }).click();
    await expect(page.getByRole("heading", { name: "Choose a delivery slot" })).toBeVisible();
    await expect(page.getByRole("group")).toHaveCount(3);
    for (const day of days) {
      await expect(page.getByRole("group", { name: day })).toBeVisible();
    }

    // 2. In each group count the radios and read the first and last labels.
    await expect(page.getByRole("radio")).toHaveCount(36);
    for (const day of days) {
      const radios = page.getByRole("group", { name: day }).getByRole("radio");
      await expect(radios).toHaveCount(12);
      await expect(radios.first()).toHaveAccessibleName(new RegExp(`^${day} 08:00 to 09:00`));
      await expect(radios.last()).toHaveAccessibleName(new RegExp(`^${day} 19:00 to 20:00`));
    }
    await expect(page.getByRole("radio", { name: /20:00 to 21:00/ })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: /07:00 to 08:00/ })).toHaveCount(0);
  });

  test("Slot picker moves to the next three dates when the store clock advances", async ({ page, request }) => {
    await startFromSeed(page, request);

    // 1. POST /__test/clock then open /slots.
    await setClock(request, "2026-03-11T08:00:00-05:00");
    await page.goto("/slots");
    await expect(page.getByRole("group")).toHaveCount(3);
    for (const day of ["Thu, Mar 12", "Fri, Mar 13", "Sat, Mar 14"]) {
      await expect(page.getByRole("group", { name: day }).getByRole("radio")).toHaveCount(12);
    }
    await expect(page.getByRole("group", { name: "Wed, Mar 11" })).toHaveCount(0);
  });

  test("Full slot at 20 orders shows Full and cannot be booked", async ({ page, request }) => {
    await startFromSeed(page, request);

    // 1. Open /slots from the seed. Locate the two Full radios.
    await page.goto("/slots");
    const wedFull = slotRadio(page, "Wed, Mar 11 18:00 to 19:00, $4.99, Full");
    const thuFull = slotRadio(page, "Thu, Mar 12 18:00 to 19:00, $4.99, Full");
    await expect(wedFull).toBeVisible();
    await expect(wedFull).toBeDisabled();
    await expect(thuFull).toBeVisible();
    await expect(thuFull).toBeDisabled();
    await expect(wedFull).not.toBeChecked();
    await expect(thuFull).not.toBeChecked();

    // 2. Compare with Fri 18:00.
    const friOpen = slotRadio(page, "Fri, Mar 13 18:00 to 19:00, $4.99");
    await expect(friOpen).toBeEnabled();
    await expect(friOpen).not.toHaveAccessibleName(/Full/);
  });

  test("Booking the last place in a slot turns it from 1 left to Full", async ({ page, request }) => {
    await startFromSeed(page, request);

    // 1. Select the 1 left slot and click 'Book slot'.
    await page.goto("/slots");
    const slot = slotRadio(page, "Wed, Mar 11 17:00 to 18:00, $4.99, 1 left");
    await expect(slot).toBeEnabled();
    await slot.check();
    await page.getByRole("button", { name: "Book slot" }).click();
    await expect(page).toHaveURL(/\/basket/);
    await expect(page.getByText("Slot booked").first()).toBeVisible();
    await expect(page.getByTestId("held-slots")).toContainText("Wed, Mar 11, 17:00 to 18:00 ($4.99)");

    // 2. Return to /slots.
    await page.goto("/slots");
    const full = slotRadio(page, "Wed, Mar 11 17:00 to 18:00, $4.99, Full");
    await expect(full).toBeVisible();
    await expect(full).toBeDisabled();
  });

  test("Next day slots stay open at 21:59 and close at 22:00 the evening before", async ({ page, request }) => {
    await startFromSeed(page, request);

    // 1. Clock 21:59, open /slots.
    await setClock(request, "2026-03-10T21:59:00-05:00");
    await page.goto("/slots");
    await expect(slotRadio(page, "Wed, Mar 11 08:00 to 09:00, $2.99")).toBeEnabled();
    await expect(page.getByText("Closed")).toHaveCount(0);

    // 2. Clock 22:00, reload /slots.
    await setClock(request, "2026-03-10T22:00:00-05:00");
    await page.goto("/slots");
    await expect(slotRadio(page, "Wed, Mar 11 08:00 to 09:00, $2.99, Closed")).toBeDisabled();
    const wed = page.getByRole("group", { name: "Wed, Mar 11" }).getByRole("radio");
    await expect(wed).toHaveCount(12);
    for (const radio of await wed.all()) {
      await expect(radio).toBeDisabled();
      await expect(radio).toHaveAccessibleName(/Closed$/);
    }
    await expect(slotRadio(page, "Thu, Mar 12 08:00 to 09:00, $2.99")).toBeEnabled();
    await expect(slotRadio(page, "Fri, Mar 13 08:00 to 09:00, $2.99")).toBeEnabled();
  });

  test("Closed slot cannot be booked and Closed replaces Full", async ({ page, request }) => {
    await startFromSeed(page, request);

    // 1. Set clock to 22:00, open /slots.
    await setClock(request, "2026-03-10T22:00:00-05:00");
    await page.goto("/slots");
    const was3Left = slotRadio(page, "Wed, Mar 11 10:00 to 11:00, $2.99, Closed");
    const wasFull = slotRadio(page, "Wed, Mar 11 18:00 to 19:00, $4.99, Closed");
    await expect(was3Left).toBeDisabled();
    await expect(wasFull).toBeDisabled();
    await expect(page.getByRole("radio", { name: /Wed, Mar 11 18:00 to 19:00.*Full/ })).toHaveCount(0);

    // 2. Try to book a closed slot, then open /basket.
    await page.getByRole("button", { name: "Book slot" }).click();
    await page.goto("/basket");
    await expect(page.getByText("No delivery slot booked.")).toBeVisible();
    await expect(page.getByTestId("delivery")).toHaveText("$0.00");
  });

  test("Cutoff moves to the following evening for the next delivery date", async ({ page, request }) => {
    await startFromSeed(page, request);

    // 1. Clock 2026-03-11 21:59, open /slots.
    await setClock(request, "2026-03-11T21:59:00-05:00");
    await page.goto("/slots");
    for (const day of ["Thu, Mar 12", "Fri, Mar 13", "Sat, Mar 14"]) {
      await expect(page.getByRole("group", { name: day })).toBeVisible();
    }
    await expect(page.getByText("Closed")).toHaveCount(0);

    // 2. Clock 2026-03-11 22:00, reload /slots.
    await setClock(request, "2026-03-11T22:00:00-05:00");
    await page.goto("/slots");
    const thu = page.getByRole("group", { name: "Thu, Mar 12" }).getByRole("radio");
    await expect(thu).toHaveCount(12);
    for (const radio of await thu.all()) {
      await expect(radio).toBeDisabled();
      await expect(radio).toHaveAccessibleName(/Closed$/);
    }
    await expect(slotRadio(page, "Fri, Mar 13 08:00 to 09:00, $2.99")).toBeEnabled();
    await expect(slotRadio(page, "Sat, Mar 14 08:00 to 09:00, $2.99")).toBeEnabled();
  });

  test("Booked slot date, time and fee appear under Delivery on the basket page", async ({ page, request }) => {
    await startFromSeed(page, request);

    // 1. Book Fri 08:00.
    await bookSlot(page, "Fri, Mar 13 08:00 to 09:00, $2.99");
    await expect(page.getByTestId("held-slots")).toContainText("Fri, Mar 13, 08:00 to 09:00 ($2.99)");
    await expect(page.getByTestId("delivery")).toHaveText("$2.99");
    await expect(page.getByTestId("total")).toHaveText("$2.99");

    // 2. Reload /basket.
    await page.goto("/basket");
    await expect(page.getByTestId("held-slots")).toContainText("Fri, Mar 13, 08:00 to 09:00 ($2.99)");
    await expect(page.getByRole("link", { name: "Basket (0)" })).toBeVisible();
  });

  test("Booking a second slot replaces the first under Delivery", async ({ page, request }) => {
    await startFromSeed(page, request);

    // 1. Book Thu 17:00, then Fri 08:00.
    await bookSlot(page, "Thu, Mar 12 17:00 to 18:00, $4.99");
    await expect(page.getByTestId("delivery")).toHaveText("$4.99");
    await bookSlot(page, "Fri, Mar 13 08:00 to 09:00, $2.99");
    await expect(page.getByTestId("held-slots").getByRole("listitem")).toHaveCount(1);
    await expect(page.getByTestId("held-slots")).toContainText("Fri, Mar 13, 08:00 to 09:00 ($2.99)");
    await expect(page.getByTestId("held-slots")).not.toContainText("Thu, Mar 12");
    await expect(page.getByTestId("delivery")).toHaveText("$2.99");
  });

  test("Slot picker prices only the 17:00 and 18:00 slots at 4.99", async ({ page, request }) => {
    await startFromSeed(page, request);

    // 1. Read the price of every Fri Mar 13 slot.
    await page.goto("/slots");
    const fri = page.getByRole("group", { name: "Fri, Mar 13" }).getByRole("radio");
    await expect(fri).toHaveCount(12);
    for (let hour = 8; hour <= 19; hour++) {
      const start = String(hour).padStart(2, "0");
      const end = String(hour + 1).padStart(2, "0");
      const price = hour === 17 || hour === 18 ? "$4.99" : "$2.99";
      await expect(slotRadio(page, `Fri, Mar 13 ${start}:00 to ${end}:00, ${price}`)).toBeVisible();
    }
  });

  test("Delivery fee flips at 17:00 and again at 19:00 when booking", async ({ page, request }) => {
    await startFromSeed(page, request);

    // 1. Book Fri 16:00.
    await bookSlot(page, "Fri, Mar 13 16:00 to 17:00, $2.99");
    await expect(page.getByTestId("delivery")).toHaveText("$2.99");

    // 2. Book Fri 17:00.
    await bookSlot(page, "Fri, Mar 13 17:00 to 18:00, $4.99");
    await expect(page.getByTestId("delivery")).toHaveText("$4.99");
    await expect(page.getByTestId("held-slots")).toContainText("Fri, Mar 13, 17:00 to 18:00 ($4.99)");
    await expect(page.getByTestId("total")).toHaveText("$4.99");

    // 3. Book Fri 18:00, then Fri 19:00.
    await bookSlot(page, "Fri, Mar 13 18:00 to 19:00, $4.99");
    await expect(page.getByTestId("delivery")).toHaveText("$4.99");
    await bookSlot(page, "Fri, Mar 13 19:00 to 20:00, $2.99");
    await expect(page.getByTestId("delivery")).toHaveText("$2.99");
  });

  test("Checkout is blocked without a slot and works after booking one", async ({ page, request }) => {
    await startFromSeed(page, request);

    // 1. Build the $25.00 basket and open /basket without a slot.
    await buildTwentyFiveDollarBasket(page);
    await page.goto("/basket");
    await expect(page.getByTestId("subtotal")).toHaveText("$25.00");
    await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
    await expect(page.getByTestId("checkout-blocked")).toHaveText("Book a delivery slot to check out.");
    await expect(page.getByText("No delivery slot booked.")).toBeVisible();

    // 2. Click 'Choose a slot', book Thu 08:00, return to /basket.
    await page.getByRole("link", { name: "Choose a slot" }).click();
    await expect(page).toHaveURL(/\/slots/);
    await bookSlot(page, "Thu, Mar 12 08:00 to 09:00, $2.99");
    await page.goto("/basket");
    await expect(page.getByRole("button", { name: "Checkout" })).toBeEnabled();
    await expect(page.getByTestId("total")).toHaveText("$27.99");

    // 3. Click 'Checkout'.
    await page.getByRole("button", { name: "Checkout" }).click();
    await expect(page.getByRole("heading", { name: "Order PR-1001 placed" })).toBeVisible();
    await expect(page.getByText("Delivery: Thu, Mar 12, 08:00 to 09:00")).toBeVisible();
  });

  test.describe("Tokyo shopper", () => {
    test.use({ timezoneId: "Asia/Tokyo" });

    test("Times show store time for a shopper in the Asia/Tokyo time zone", async ({ page, request }) => {
      await startFromSeed(page, request);

      // 1. Open /slots.
      await page.goto("/slots");
      await expect(page.getByRole("group")).toHaveCount(3);
      for (const day of days) {
        await expect(page.getByRole("group", { name: day })).toBeVisible();
      }
      await expect(slotRadio(page, "Wed, Mar 11 08:00 to 09:00, $2.99")).toBeVisible();
      await expect(page.getByRole("group", { name: "Wed, Mar 11" }).getByRole("radio").last()).toHaveAccessibleName(
        /^Wed, Mar 11 19:00 to 20:00/,
      );

      // 2. Book Thu 17:00.
      await bookSlot(page, "Thu, Mar 12 17:00 to 18:00, $4.99");
      await expect(page.getByTestId("held-slots")).toContainText("Thu, Mar 12, 17:00 to 18:00 ($4.99)");
    });

    test("Cutoff follows store time when the shopper time zone is ahead of the store", async ({ page, request }) => {
      await startFromSeed(page, request);

      // 1. Clock 21:59 store time (11:59 Mar 11 in Tokyo), open /slots.
      await setClock(request, "2026-03-10T21:59:00-05:00");
      await page.goto("/slots");
      await expect(slotRadio(page, "Wed, Mar 11 08:00 to 09:00, $2.99")).toBeEnabled();
      await expect(page.getByText("Closed")).toHaveCount(0);

      // 2. Clock 22:00 store time, reload.
      await setClock(request, "2026-03-10T22:00:00-05:00");
      await page.goto("/slots");
      const wed = page.getByRole("group", { name: "Wed, Mar 11" }).getByRole("radio");
      await expect(wed).toHaveCount(12);
      for (const radio of await wed.all()) {
        await expect(radio).toBeDisabled();
        await expect(radio).toHaveAccessibleName(/Closed$/);
      }
    });

    test("Placed order shows the delivery time in store time for a Tokyo shopper", async ({ page, request }) => {
      await startFromSeed(page, request);

      // 1. Build the basket, book Thu 08:00, check out, open /orders.
      await buildTwentyFiveDollarBasket(page);
      await bookSlot(page, "Thu, Mar 12 08:00 to 09:00, $2.99");
      await page.goto("/basket");
      await page.getByRole("button", { name: "Checkout" }).click();
      await expect(page.getByRole("heading", { name: "Order PR-1001 placed" })).toBeVisible();
      await expect(page.getByText("Delivery: Thu, Mar 12, 08:00 to 09:00")).toBeVisible();

      await page.goto("/orders");
      // The orders list shows only the number and total; reopen the order from it.
      await expect(page.getByRole("main")).toContainText("PR-1001, $27.99");
      await page.getByRole("link", { name: /PR-1001/ }).click();
      await expect(page.getByText("Delivery: Thu, Mar 12, 08:00 to 09:00")).toBeVisible();
    });
  });

  test("Slot with 3 places left shows 3 left and drops to 2 left after a booking", async ({ page, request }) => {
    await startFromSeed(page, request);

    // 1. Open /slots from the seed.
    await page.goto("/slots");
    const threeLeft = slotRadio(page, "Wed, Mar 11 10:00 to 11:00, $2.99, 3 left");
    await expect(threeLeft).toBeVisible();
    await expect(threeLeft).toBeEnabled();

    // 2. Book the 10:00 slot and reopen /slots.
    await bookSlot(page, "Wed, Mar 11 10:00 to 11:00, $2.99, 3 left");
    await page.goto("/slots");
    const twoLeft = slotRadio(page, "Wed, Mar 11 10:00 to 11:00, $2.99, 2 left");
    await expect(twoLeft).toBeVisible();
    await expect(twoLeft).toBeEnabled();
    await expect(twoLeft).toBeChecked();
  });

  test("Slots with more than 3 places left show no N left label", async ({ page, request }) => {
    await startFromSeed(page, request);

    // 1. Open /slots and read the two plain labels.
    await page.goto("/slots");
    await expect(slotRadio(page, "Wed, Mar 11 09:00 to 10:00, $2.99")).toBeVisible();
    await expect(slotRadio(page, "Fri, Mar 13 17:00 to 18:00, $4.99")).toBeVisible();
    await expect(page.getByRole("radio", { name: /, \d+ left$/ })).toHaveCount(2);
    await expect(page.getByRole("radio", { name: /, Full$/ })).toHaveCount(2);
    await expect(slotRadio(page, "Wed, Mar 11 10:00 to 11:00, $2.99, 3 left")).toBeVisible();
    await expect(slotRadio(page, "Wed, Mar 11 17:00 to 18:00, $4.99, 1 left")).toBeVisible();
    await expect(slotRadio(page, "Wed, Mar 11 18:00 to 19:00, $4.99, Full")).toBeVisible();
    await expect(page.getByRole("radio", { name: /0 left/ })).toHaveCount(0);
  });
});
