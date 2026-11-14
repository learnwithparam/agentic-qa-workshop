// spec: specs/book-a-slot.md
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

test.describe("Booking a slot", () => {
  test("A full slot shows Full and cannot be booked", async ({ page }) => {
    await page.goto("/slots");
    await expect(
      page.getByRole("radio", { name: /Mar 11 18:00 to 19:00, \$4\.99, Full/ }),
    ).toBeDisabled();
    await expect(page.getByRole("radio", { name: /Mar 12 08:00/ })).toBeEnabled();
  });

  test("The basket shows the booked slot and its fee", async ({ page }) => {
    await page.goto("/slots");
    await page.getByRole("radio", { name: /Mar 12 09:00 to 10:00/ }).check();
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
