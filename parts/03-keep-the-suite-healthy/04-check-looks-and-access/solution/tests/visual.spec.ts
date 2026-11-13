// Visual checks: the "Bananas, loose" card and the slot picker, at phone and desktop widths.
import { expect, type Page, test } from "@playwright/test";

const WIDTHS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 800 },
];

async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("ana@pantryrun.test");
  await page.getByLabel("Password").fill("pantry");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.beforeEach(async ({ request }) => {
  await request.post("/__test/reset");
});

for (const { name, width, height } of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height } });

    test(`Bananas, loose card (${name})`, async ({ page }) => {
      await page.goto("/");
      const card = page.getByRole("article", { name: "Bananas, loose" });
      await expect(card).toBeVisible();
      await expect(card).toHaveScreenshot(`bananas-card-${name}.png`);
    });

    test(`slot picker (${name})`, async ({ page }) => {
      await signIn(page);
      await page.goto("/slots");
      const picker = page.locator("#slot-form");
      await expect(picker).toBeVisible();
      await expect(picker).toHaveScreenshot(`slot-picker-${name}.png`);
    });
  });
}
