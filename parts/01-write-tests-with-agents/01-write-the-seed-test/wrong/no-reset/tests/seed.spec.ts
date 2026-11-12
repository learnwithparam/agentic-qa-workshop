// seed: every test starts here. Fresh shop data, Ana signed in, an empty basket on screen.
import { expect, test } from "@playwright/test";

test.describe("Pantry Run", () => {
  test("seed", async ({ page }) => {
    await page.goto("/signin");
    await page.getByLabel("Email").fill("ana@pantryrun.test");
    await page.getByLabel("Password").fill("pantry");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.goto("/basket");
    await expect(page.getByRole("heading", { name: "Your basket" })).toBeVisible();
    await expect(page.getByTestId("empty-basket")).toBeVisible();
  });
});
