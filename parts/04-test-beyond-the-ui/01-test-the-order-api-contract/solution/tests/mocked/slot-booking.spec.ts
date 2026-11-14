// mock: the booking call is answered by the test, so the shop's own booking is never reached.
// One browser test, one mocked call. It shows the shopper a clear message when booking fails.
import { expect, test } from "@playwright/test";

test("a failed booking shows a message and keeps the shopper on the page", async ({ page }) => {
  await page.route("**/api/slots/*/book", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "unavailable", message: "Booking is down. Try again soon." }),
    }),
  );
  await page.request.post("/__test/reset");
  await page.goto("/signin?next=/slots");
  await page.getByLabel("Email").fill("ana@pantryrun.test");
  await page.getByLabel("Password").fill("pantry");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Book" }).click();
  await expect(page.getByRole("alert")).toHaveText("Booking is down. Try again soon.");
  await expect(page).toHaveURL(/\/slots/);
});
