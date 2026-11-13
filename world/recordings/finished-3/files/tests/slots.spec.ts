// spec: specs/slots.md
// seed: tests/seed.spec.ts
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

async function start(page: Page, request: APIRequestContext, clockAt?: string) {
  await request.post("/__test/reset");
  if (clockAt) {
    await request.post("/__test/clock", { data: { at: clockAt } });
  }
  await page.goto("/signin");
  await page.getByLabel("Email").fill("ana@pantryrun.test");
  await page.getByLabel("Password").fill("pantry");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/basket");
  await expect(page.getByRole("heading", { name: "Your basket" })).toBeVisible();
}

async function addCheddar(page: Page, times: number) {
  await page.goto("/");
  const card = page.getByRole("article", { name: "Extra mature farmhouse cheddar 400 g" });
  for (let i = 1; i <= times; i++) {
    await card.getByRole("button", { name: "Add" }).click();
    await page.waitForURL(/added=CHS-CHED/);
  }
  await page.goto("/basket");
  await expect(page.getByTestId("subtotal")).toHaveText("$25.50");
}

async function bookSlot(page: Page, name: string | RegExp) {
  await page.goto("/slots");
  await page.getByRole("radio", { name }).check();
  await page.getByRole("button", { name: "Book slot" }).click();
  await expect(page.getByRole("status")).toHaveText("Slot booked");
}

const slotRadios = (page: Page) => page.getByRole("radio");

test.describe("Delivery slots", () => {
  test("Slot picker lists 08:00 to 19:00 slots for three dates", async ({ page, request }) => {
    await start(page, request);

    // 1. Click the nav link "Delivery slots".
    await page.getByRole("link", { name: "Delivery slots" }).click();

    await expect(page.getByRole("heading", { name: "Choose a delivery slot" })).toBeVisible();
    await expect(slotRadios(page)).toHaveCount(36);
    await expect(page.getByRole("radio", { name: /^Wed, Mar 11 / })).toHaveCount(12);
    await expect(page.getByRole("radio", { name: /^Thu, Mar 12 / })).toHaveCount(12);
    await expect(page.getByRole("radio", { name: /^Fri, Mar 13 / })).toHaveCount(12);
    await expect(page.getByRole("radio", { name: "Fri, Mar 13 08:00 to 09:00, $2.99" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Fri, Mar 13 19:00 to 20:00, $2.99" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Mar 1[123] 07:00 to / })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: /Mar 1[123] 20:00 to / })).toHaveCount(0);
  });

  test("First 08:00 and last 19:00 slots are bookable", async ({ page, request }) => {
    await start(page, request);

    // 1. On /slots, choose the 08:00 slot and click "Book slot".
    await bookSlot(page, "Fri, Mar 13 08:00 to 09:00, $2.99");
    await expect(page.getByTestId("held-slots")).toHaveText("Fri, Mar 13, 08:00 to 09:00 ($2.99)");

    // 2. Go back to /slots, choose the 19:00 slot and click "Book slot".
    await bookSlot(page, "Fri, Mar 13 19:00 to 20:00, $2.99");
    await expect(page.getByTestId("held-slots")).toHaveText("Fri, Mar 13, 19:00 to 20:00 ($2.99)");
  });

  test("Slots with 3 or fewer places left show N left", async ({ page, request }) => {
    await start(page, request);

    // 1. Open /slots.
    await page.goto("/slots");

    await expect(page.getByRole("radio", { name: "Wed, Mar 11 10:00 to 11:00, $2.99, 3 left" })).toBeEnabled();
    await expect(page.getByRole("radio", { name: "Wed, Mar 11 17:00 to 18:00, $4.99, 1 left" })).toBeEnabled();
    await expect(page.getByRole("radio", { name: "Wed, Mar 11 09:00 to 10:00, $2.99", exact: true })).toBeVisible();
    await expect(page.getByRole("radio", { name: /(\d{2,}|[4-9]) left/ })).toHaveCount(0);
  });

  test("Booking the 20th order fills a slot", async ({ page, request }) => {
    await start(page, request);

    // 1. Add "Extra mature farmhouse cheddar 400 g" six times ($25.50).
    await addCheddar(page, 6);

    // 2. On /slots, book "Wed, Mar 11 17:00 to 18:00, $4.99, 1 left".
    await bookSlot(page, "Wed, Mar 11 17:00 to 18:00, $4.99, 1 left");

    // 3. On /basket, click Checkout and place the order.
    await page.getByRole("button", { name: "Checkout" }).click();
    await expect(page.getByRole("heading", { name: /Order PR-\d+ placed/ })).toBeVisible();
    await expect(page.getByText("Delivery: Wed, Mar 11, 17:00 to 18:00")).toBeVisible();

    // 4. Open /slots again.
    await page.goto("/slots");
    const slot = page.getByRole("radio", { name: "Wed, Mar 11 17:00 to 18:00, $4.99, Full" });
    await expect(slot).toBeVisible();
    await expect(slot).toBeDisabled();
  });

  test("Full slots cannot be booked", async ({ page, request }) => {
    await start(page, request);

    // 1. Open /slots.
    await page.goto("/slots");

    // 2. Try to choose "Wed, Mar 11 18:00 to 19:00, $4.99, Full".
    const wedFull = page.getByRole("radio", { name: "Wed, Mar 11 18:00 to 19:00, $4.99, Full" });
    const thuFull = page.getByRole("radio", { name: "Thu, Mar 12 18:00 to 19:00, $4.99, Full" });
    await expect(wedFull).toBeDisabled();
    await expect(thuFull).toBeDisabled();
    await expect(wedFull).not.toBeChecked();
    await expect(page.getByRole("radio", { name: "Fri, Mar 13 18:00 to 19:00, $4.99" })).toBeEnabled();

    await page.goto("/basket");
    await expect(page.getByText("No delivery slot booked.")).toBeVisible();
  });

  test("Next-day slots are still open at 21:59 store time", async ({ page, request }) => {
    await start(page, request, "2026-03-10T21:59:00-05:00");

    // 1. Set the clock to 21:59 store time and open /slots.
    await page.goto("/slots");
    await expect(page.getByRole("radio", { name: "Wed, Mar 11 08:00 to 09:00, $2.99" })).toBeEnabled();
    await expect(page.getByRole("radio", { name: /Closed/ })).toHaveCount(0);

    // 2. Book "Wed, Mar 11 08:00 to 09:00, $2.99".
    await bookSlot(page, "Wed, Mar 11 08:00 to 09:00, $2.99");
    await expect(page.getByTestId("held-slots")).toHaveText("Wed, Mar 11, 08:00 to 09:00 ($2.99)");
  });

  test("Next-day slots show Closed at 22:00 store time", async ({ page, request }) => {
    await start(page, request, "2026-03-10T22:00:00-05:00");

    // 1. Set the clock to 22:00 store time and open /slots.
    await page.goto("/slots");

    const closed = page.getByRole("radio", { name: /^Wed, Mar 11 .*, Closed$/ });
    await expect(closed).toHaveCount(12);
    for (const radio of await closed.all()) {
      await expect(radio).toBeDisabled();
    }
    await expect(page.getByRole("radio", { name: "Thu, Mar 12 08:00 to 09:00, $2.99" })).toBeEnabled();
  });

  test("A closed slot cannot be booked", async ({ page, request }) => {
    await start(page, request, "2026-03-10T23:30:00-05:00");

    // 1. Set the clock to 23:30 store time and open /slots.
    await page.goto("/slots");

    // 2. Try to choose the Closed slot and click "Book slot".
    const closed = page.getByRole("radio", { name: "Wed, Mar 11 08:00 to 09:00, $2.99, Closed" });
    await expect(closed).toBeDisabled();
    await expect(closed).not.toBeChecked();
    await page.getByRole("button", { name: "Book slot" }).click();

    await page.goto("/basket");
    await expect(page.getByText("No delivery slot booked.")).toBeVisible();
  });

  test("Booked slot date, time and fee appear in the basket", async ({ page, request }) => {
    await start(page, request);

    // 1. On /slots, book "Thu, Mar 12 09:00 to 10:00, $2.99".
    await bookSlot(page, "Thu, Mar 12 09:00 to 10:00, $2.99");
    await expect(page.getByTestId("held-slots")).toHaveText("Thu, Mar 12, 09:00 to 10:00 ($2.99)");
    await expect(page.getByTestId("delivery")).toHaveText("$2.99");

    // 2. Reload /basket.
    await page.goto("/basket");
    await expect(page.getByTestId("held-slots")).toHaveText("Thu, Mar 12, 09:00 to 10:00 ($2.99)");
    await expect(page.getByTestId("delivery")).toHaveText("$2.99");
  });

  test("Fee is $2.99 at 16:00 and $4.99 at 17:00", async ({ page, request }) => {
    await start(page, request);

    // 1. Book "Fri, Mar 13 16:00 to 17:00".
    await bookSlot(page, /^Fri, Mar 13 16:00 to 17:00/);
    await expect(page.getByTestId("held-slots")).toHaveText("Fri, Mar 13, 16:00 to 17:00 ($2.99)");
    await expect(page.getByTestId("delivery")).toHaveText("$2.99");

    // 2. Book "Fri, Mar 13 17:00 to 18:00".
    await bookSlot(page, /^Fri, Mar 13 17:00 to 18:00/);
    await expect(page.getByTestId("held-slots")).toHaveText("Fri, Mar 13, 17:00 to 18:00 ($4.99)");
    await expect(page.getByTestId("delivery")).toHaveText("$4.99");
  });

  test("Fee is $4.99 at 18:00 and $2.99 again at 19:00", async ({ page, request }) => {
    await start(page, request);

    // 1. Book "Fri, Mar 13 18:00 to 19:00".
    await bookSlot(page, /^Fri, Mar 13 18:00 to 19:00/);
    await expect(page.getByTestId("delivery")).toHaveText("$4.99");

    // 2. Book "Fri, Mar 13 19:00 to 20:00".
    await bookSlot(page, /^Fri, Mar 13 19:00 to 20:00/);
    await expect(page.getByTestId("delivery")).toHaveText("$2.99");

    // 3. Open /slots and read every slot's fee.
    await page.goto("/slots");
    await expect(slotRadios(page)).toHaveCount(36);
    await expect(page.getByRole("radio", { name: /\$4\.99/ })).toHaveCount(6);
    await expect(page.getByRole("radio", { name: /\$2\.99/ })).toHaveCount(30);
    await expect(page.getByRole("radio", { name: /^\S+, Mar \d+ 1[78]:00 to .*\$4\.99/ })).toHaveCount(6);
  });

  test("Checkout is blocked without a booked slot", async ({ page, request }) => {
    await start(page, request);

    // 1. Add "Extra mature farmhouse cheddar 400 g" six times and open /basket.
    await addCheddar(page, 6);
    await expect(page.getByText("No delivery slot booked.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
    await expect(page.getByText("Book a delivery slot to check out.")).toBeVisible();

    // 2. Book "Thu, Mar 12 09:00 to 10:00, $2.99" and return to /basket.
    await bookSlot(page, "Thu, Mar 12 09:00 to 10:00, $2.99");
    await expect(page.getByRole("button", { name: "Checkout" })).toBeEnabled();
    await expect(page.getByText("Book a delivery slot to check out.")).toHaveCount(0);
  });

  test.describe("Other time zone", () => {
    test.use({ timezoneId: "Asia/Tokyo" });

    test("Slot times are store time in another browser time zone", async ({ page, request }) => {
      // 1. Use a browser in time zone "Asia/Tokyo". Reset, sign in and open /slots.
      await start(page, request);
      await page.goto("/slots");
      await expect(slotRadios(page).first()).toHaveAccessibleName("Wed, Mar 11 08:00 to 09:00, $2.99");

      // 2. Book "Thu, Mar 12 17:00 to 18:00, $4.99".
      await bookSlot(page, "Thu, Mar 12 17:00 to 18:00, $4.99");
      await expect(page.getByTestId("held-slots")).toHaveText("Thu, Mar 12, 17:00 to 18:00 ($4.99)");

      // 3. Set the clock to 22:00 store time and open /slots.
      await request.post("/__test/clock", { data: { at: "2026-03-10T22:00:00-05:00" } });
      await page.goto("/slots");
      await expect(page.getByRole("radio", { name: /^Wed, Mar 11 .*, Closed$/ })).toHaveCount(12);
      await expect(page.getByRole("radio", { name: "Thu, Mar 12 08:00 to 09:00, $2.99" })).toBeEnabled();
    });
  });
});
