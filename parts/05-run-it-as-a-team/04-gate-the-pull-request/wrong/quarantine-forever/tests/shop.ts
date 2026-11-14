// Shared steps for the suite. Every test starts from fresh shop data, signed in as Ana.
import { expect, type Page } from "@playwright/test";

export async function freshShopAsAna(page: Page) {
  const reset = await page.request.post("/__test/reset");
  expect(reset.ok()).toBeTruthy();
  await page.goto("/signin");
  await page.getByLabel("Email").fill("ana@pantryrun.test");
  await page.getByLabel("Password").fill("pantry");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Signed in as")).toBeVisible();
}

export async function addItem(page: Page, name: string, weight?: string) {
  await page.goto("/");
  const card = page.getByRole("article", { name, exact: true });
  if (weight) await card.getByLabel(`Weight of ${name}`).selectOption({ label: weight });
  await card.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("status")).toHaveText(`Added ${name} to your basket`);
}

export async function setQuantity(page: Page, name: string, quantity: number) {
  await page.goto("/basket");
  await page.getByLabel(`Quantity of ${name}`).fill(String(quantity));
  await page.getByRole("button", { name: `Update ${name}` }).click();
}

export const basketLine = (page: Page, name: string) =>
  page.getByTestId("basket-line").filter({ hasText: name });
