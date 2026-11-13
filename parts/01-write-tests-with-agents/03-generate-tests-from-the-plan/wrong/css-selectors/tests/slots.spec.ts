// spec: specs/slots.md
// seed: tests/seed.spec.ts
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page, request }) => {
  await request.post("/__test/reset");
  await page.goto("/signin");
  await page.getByLabel("Email").fill("ana@pantryrun.test");
  await page.getByLabel("Password").fill("pantry");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Signed in as Ana Torres")).toBeVisible();
});

test.describe("Seeing slots", () => {
  test("Shows one-hour slots from 08:00 to 20:00 for three dates", async ({ page }) => {
    // 1. Open Delivery slots.
    await page.goto("/slots");
    await expect(page.getByRole("group")).toHaveCount(3);
    await expect(page.getByRole("radio")).toHaveCount(36);
    await expect(page.getByRole("radio", { name: /Mar 11 08:00 to 09:00/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Mar 13 19:00 to 20:00/ })).toBeVisible();
  });

  test("Peak slots cost $4.99 and others $2.99", async ({ page }) => {
    await page.goto("/slots");
    await expect(page.getByRole("radio", { name: /Mar 12 17:00 to 18:00, \$4\.99/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Mar 12 16:00 to 17:00, \$2\.99/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Mar 12 19:00 to 20:00, \$2\.99/ })).toBeVisible();
  });

  test("A slot with three or fewer places shows how many are left", async ({ page }) => {
    await page.goto("/slots");
    await expect(
      page.getByRole("radio", { name: /Mar 11 17:00 to 18:00, \$4\.99, 1 left/ }),
    ).toBeEnabled();
    await expect(
      page.getByRole("radio", { name: /Mar 11 10:00 to 11:00, \$2\.99, 3 left/ }),
    ).toBeEnabled();
  });
});

test.describe("Booking rules", () => {
  test("A full slot shows Full and cannot be booked", async ({ page }) => {
    await page.goto("/slots");
    await expect(
      page.getByRole("radio", { name: /Mar 11 18:00 to 19:00, \$4\.99, Full/ }),
    ).toBeDisabled();
  });

  test("Next-date slots close at 22:00 store time", async ({ page, request }) => {
    // 1. Set the store clock to 21:59 the evening before.
    await request.post("/__test/clock", { data: { at: "2026-03-10T21:59:00-05:00" } });
    await page.goto("/slots");
    await expect(page.getByRole("radio", { name: /Mar 11 08:00/ })).toBeEnabled();
    // 2. Set the store clock to 22:00.
    await request.post("/__test/clock", { data: { at: "2026-03-10T22:00:00-05:00" } });
    await page.goto("/slots");
    await expect(
      page.getByRole("radio", { name: /Mar 11 08:00 to 09:00, \$2\.99, Closed/ }),
    ).toBeDisabled();
    await expect(page.getByRole("radio", { name: /Mar 12 08:00/ })).toBeEnabled();
  });

  test("The basket shows the booked slot and its fee", async ({ page }) => {
    await page.goto("/slots");
    await page.locator("#slot-2026-03-12T09").check();
    await page.locator("form#slot-form button[type=submit]").click();
    await expect(page).toHaveURL(/\/basket/);
    await expect(page.getByTestId("held-slots")).toHaveText("Thu, Mar 12, 09:00 to 10:00 ($2.99)");
  });

  test("Checkout needs a booked slot", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("article", { name: "Ground coffee 227 g" })
      .getByRole("button", { name: "Add" })
      .click();
    await page.goto("/basket");
    await page.getByLabel("Quantity of Ground coffee 227 g").fill("6");
    await page.getByRole("button", { name: "Update Ground coffee 227 g" }).click();
    await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
    await expect(page.getByTestId("checkout-blocked")).toHaveText(
      "Book a delivery slot to check out.",
    );
  });
});
