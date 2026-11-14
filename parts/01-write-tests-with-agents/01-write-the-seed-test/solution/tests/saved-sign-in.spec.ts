// saved sign-in: sign in once, keep the cookies in a file, and let other tests start already signed in.
import { expect, test } from "@playwright/test";

const SIGNED_IN_FILE = ".auth/ana.json";

test.describe.configure({ mode: "serial" });

test("save Ana's sign-in to a file", async ({ page, request }) => {
  await request.post("/__test/reset");
  await page.goto("/signin");
  await page.getByLabel("Email").fill("ana@pantryrun.test");
  await page.getByLabel("Password").fill("pantry");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Signed in as")).toBeVisible();
  await page.context().storageState({ path: SIGNED_IN_FILE });
});

test.describe("with the saved sign-in", () => {
  test.use({ storageState: SIGNED_IN_FILE });

  test("the basket opens with no sign-in page in between", async ({ page }) => {
    await page.goto("/basket");
    await expect(page.getByText("Signed in as")).toBeVisible();
    await expect(page.getByTestId("empty-basket")).toBeVisible();
  });
});
