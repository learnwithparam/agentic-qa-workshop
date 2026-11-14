// spec: plans/create-a-note.md
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/notes");
});

test("a new note appears in the list", async ({ page }) => {
  await page.getByLabel("Title").fill("Ridge loop");
  await page.getByLabel("Tag").selectOption("Day hike");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByRole("listitem").first()).toContainText("Ridge loop");
});

test("an empty title is refused", async ({ page }) => {
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByRole("alert")).toHaveText("A title is needed");
  await expect(page.getByRole("listitem")).toHaveCount(0);
});

test("a very long title is cut in the list", async ({ page }) => {
  await page.getByLabel("Title").fill("a".repeat(200));
  await page.getByRole("button", { name: "Add note" }).click();
  const firstRow = page.getByRole("listitem").first();
  await expect(firstRow).toContainText("aaaa");
  await expect(firstRow).not.toContainText("a".repeat(200));
});
