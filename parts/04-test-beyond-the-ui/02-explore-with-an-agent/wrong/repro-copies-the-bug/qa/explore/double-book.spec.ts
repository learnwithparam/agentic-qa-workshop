// finding: a double click on Book slot books the slot twice and charges the fee twice
import { expect, test } from "@playwright/test";
import { freshShopAsAna } from "./shop";

// Claude Code wrote down what it saw on the buggy shop, so this test expects the bug.
test("a double click on Book slot books two slots", async ({ page }) => {
  await freshShopAsAna(page);
  await page.goto("/slots");
  await page.getByRole("radio", { name: /Mar 12 09:00/ }).check();
  await page.getByRole("button", { name: "Book slot" }).dblclick();
  await expect(page).toHaveURL(/\/basket/);
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(page.getByTestId("held-slots").getByRole("listitem")).toHaveCount(2);
  await expect(page.getByTestId("delivery")).toHaveText("$5.98");
});
