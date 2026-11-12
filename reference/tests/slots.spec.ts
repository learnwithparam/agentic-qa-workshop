// spec: world/requirements/slots.md
import { expect, test } from "@playwright/test";
import { bookSlot, freshShop, reachMinimum, setStoreClock, signIn } from "./shop";

test.beforeEach(async ({ page, request }) => {
  await freshShop(request);
  await signIn(page);
});

test("shows one-hour slots from 08:00 to 20:00 for three dates", async ({ page }) => {
  await page.goto("/slots");
  await expect(page.getByRole("radio")).toHaveCount(36);
  await expect(page.getByRole("group")).toHaveCount(3);
  await expect(page.getByRole("radio", { name: /Mar 11 08:00 to 09:00/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Mar 13 19:00 to 20:00/ })).toBeVisible();
});

test("a full slot shows Full and cannot be booked", async ({ page }) => {
  await page.goto("/slots");
  const full = page.getByRole("radio", { name: /Mar 11 18:00 to 19:00/ });
  await expect(full).toBeDisabled();
  await expect(page.getByText("Wed, Mar 11 18:00 to 19:00, $4.99, Full")).toBeVisible();
});

test("next-date slots close at 22:00 store time", async ({ page, request }) => {
  await setStoreClock(request, "2026-03-10T21:59:00-05:00");
  await page.goto("/slots");
  await expect(page.getByRole("radio", { name: /Mar 11 08:00/ })).toBeEnabled();
  await setStoreClock(request, "2026-03-10T22:00:00-05:00");
  await page.goto("/slots");
  await expect(page.getByRole("radio", { name: /Mar 11 08:00/ })).toBeDisabled();
  await expect(
    page.getByRole("radio", { name: /Mar 11 08:00 to 09:00, \$2.99, Closed/ }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: /Mar 12 08:00/ })).toBeEnabled();
});

test("the basket shows the booked slot and its fee", async ({ page }) => {
  await bookSlot(page, /Mar 12 09:00 to 10:00/);
  await expect(page.getByTestId("held-slots")).toHaveText("Thu, Mar 12, 09:00 to 10:00 ($2.99)");
});

test("peak slots cost $4.99 and others $2.99", async ({ page }) => {
  await page.goto("/slots");
  await expect(page.getByRole("radio", { name: /Mar 12 17:00 to 18:00, \$4.99/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Mar 12 16:00 to 17:00, \$2.99/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Mar 12 19:00 to 20:00, \$2.99/ })).toBeVisible();
});

test("checkout needs a booked slot", async ({ page }) => {
  await reachMinimum(page);
  await page.goto("/basket");
  await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
  await expect(page.getByTestId("checkout-blocked")).toHaveText(
    "Book a delivery slot to check out.",
  );
});

test("a slot with three or fewer places shows how many are left", async ({ page }) => {
  await page.goto("/slots");
  await expect(
    page.getByRole("radio", { name: /Mar 11 17:00 to 18:00, \$4.99, 1 left/ }),
  ).toBeEnabled();
  await expect(
    page.getByRole("radio", { name: /Mar 11 10:00 to 11:00, \$2.99, 3 left/ }),
  ).toBeEnabled();
});
