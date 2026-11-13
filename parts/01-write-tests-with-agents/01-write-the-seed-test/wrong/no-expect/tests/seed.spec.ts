// seed: every test starts here. Fresh shop data, Ana signed in, an empty basket on screen.
import { test } from "@playwright/test";

test.describe("Pantry Run", () => {
  test("seed", async ({ page, request }) => {
    await request.post("/__test/reset");
    await page.goto("/signin");
    await page.getByLabel("Email").fill("ana@pantryrun.test");
    await page.getByLabel("Password").fill("pantry");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.goto("/basket");
  });
});
