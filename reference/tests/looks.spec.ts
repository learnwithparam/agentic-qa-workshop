// Looks and access: the layout holds on a phone, and the slot picker has names a screen reader can read.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { freshShop, signIn } from "./shop";

test.beforeEach(async ({ request }) => freshShop(request));

test("on a 375 px phone no price sits on its Add button", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  const cards = page.getByRole("article");
  const n = await cards.count();
  expect(n).toBeGreaterThan(10);
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i);
    const price = await card.locator(".price").boundingBox();
    const button = await card.getByRole("button", { name: "Add" }).boundingBox();
    expect(price && button).toBeTruthy();
    const overlap =
      price!.x < button!.x + button!.width &&
      button!.x < price!.x + price!.width &&
      price!.y < button!.y + button!.height &&
      button!.y < price!.y + price!.height;
    expect(overlap, `price overlaps Add on card ${i + 1}`).toBe(false);
  }
});

test("the slot picker has no WCAG 2.1 AA violations", async ({ page }) => {
  await signIn(page);
  await page.goto("/slots");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("the shop page has no WCAG 2.1 AA violations", async ({ page }) => {
  await signIn(page);
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});
