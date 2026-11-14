// seed: every test starts here. The notes page is open and the list is empty.
import { expect, test } from "@playwright/test";

test("seed", async ({ page }) => {
  await page.goto("/notes");
  await expect(page.getByRole("heading", { name: "Your notes" })).toBeVisible();
});
