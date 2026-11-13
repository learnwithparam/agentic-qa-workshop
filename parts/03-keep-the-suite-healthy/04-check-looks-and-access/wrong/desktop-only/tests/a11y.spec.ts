// Accessibility checks with axe: the shop page and the slot picker
// must have no WCAG 2.1 A/AA violations.
import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

type AxeFixture = { makeAxeBuilder: () => AxeBuilder };

// One shared axe setup, as in https://playwright.dev/docs/accessibility-testing.
// No rules are disabled. If one ever must be, call .disableRules() here
// with a comment naming the ticket.
const test = base.extend<AxeFixture>({
  makeAxeBuilder: async ({ page }, use) => {
    const makeAxeBuilder = () =>
      new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
    await use(makeAxeBuilder);
  },
});

async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("ana@pantryrun.test");
  await page.getByLabel("Password").fill("pantry");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.beforeEach(async ({ request }) => {
  await request.post("/__test/reset");
});

test("shop page has no WCAG A/AA violations", async ({ page, makeAxeBuilder }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const results = await makeAxeBuilder().analyze();
  expect(results.violations).toEqual([]);
});

test("slot picker has no WCAG A/AA violations", async ({ page, makeAxeBuilder }) => {
  await signIn(page);
  await page.goto("/slots");
  await expect(page.locator("#slot-form")).toBeVisible();
  const results = await makeAxeBuilder().include("#slot-form").analyze();
  expect(results.violations).toEqual([]);
});
