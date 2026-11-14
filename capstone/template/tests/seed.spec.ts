// seed: every test starts here.
// TODO: open your app in a known state and expect one thing you can see.
import { test } from "@playwright/test";

test("seed", async ({ page }) => {
  await page.goto("/");
  // TODO: replace this with an expect that proves you are in the right place.
});
