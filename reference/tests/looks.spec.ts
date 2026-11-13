// Looks and access: the layout holds on a phone,
// and the slot picker has names a screen reader can read.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { freshShop, signIn } from "./shop";

type Box = { x: number; y: number; width: number; height: number };

// Two boxes overlap when each one starts before the other one ends, across and down.
function boxesOverlap(first: Box, second: Box) {
  const overlapAcross = first.x < second.x + second.width && second.x < first.x + first.width;
  const overlapDown = first.y < second.y + second.height && second.y < first.y + first.height;
  return overlapAcross && overlapDown;
}

test.beforeEach(async ({ request }) => freshShop(request));

test("on a 375 px phone no price sits on its Add button", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  const cards = page.getByRole("article");
  const cardCount = await cards.count();
  expect(cardCount).toBeGreaterThan(10);
  for (let i = 0; i < cardCount; i++) {
    const card = cards.nth(i);
    const priceBox = await card.locator(".price").boundingBox();
    const buttonBox = await card.getByRole("button", { name: "Add" }).boundingBox();
    expect(priceBox && buttonBox).toBeTruthy();
    if (priceBox && buttonBox) {
      const overlap = boxesOverlap(priceBox, buttonBox);
      expect(overlap, `price overlaps Add on card ${i + 1}`).toBe(false);
    }
  }
});

test("the slot picker has no WCAG 2.1 AA violations", async ({ page }) => {
  await signIn(page);
  await page.goto("/slots");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
});

test("the shop page has no WCAG 2.1 AA violations", async ({ page }) => {
  await signIn(page);
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
});
