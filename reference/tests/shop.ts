// Shared steps for the finished suite. Every test starts from the seed and the seeded store clock.
import { type APIRequestContext, expect, type Page } from "@playwright/test";

export const ANA = { email: "ana@pantryrun.test", password: "pantry" };
// The HTTP header a partner app sends to call the orders API. Header names ignore case.
export const PARTNER = { authorization: "Bearer pantry-partner-key" };

export async function freshShop(request: APIRequestContext) {
  const response = await request.post("/__test/reset");
  expect(response.ok()).toBeTruthy();
}

export async function setStoreClock(request: APIRequestContext, storeTime: string) {
  const response = await request.post("/__test/clock", { data: { at: storeTime } });
  expect(response.ok()).toBeTruthy();
}

export async function signIn(page: Page, shopper = ANA) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(shopper.email);
  await page.getByLabel("Password").fill(shopper.password);
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

export function basketLine(page: Page, name: string) {
  return page.getByTestId("basket-line").filter({ hasText: name });
}

export async function setQuantity(page: Page, name: string, quantity: number) {
  await page.goto("/basket");
  await page.getByLabel(`Quantity of ${name}`).fill(String(quantity));
  await page.getByRole("button", { name: `Update ${name}` }).click();
}

// Ground coffee at $4.49: six of them clear the $25.00 minimum on their own.
export async function reachMinimum(page: Page) {
  await addItem(page, "Ground coffee 227 g");
  await setQuantity(page, "Ground coffee 227 g", 6);
}

export async function bookSlot(page: Page, slot: RegExp) {
  await page.goto("/slots");
  await page.getByRole("radio", { name: slot }).check();
  await page.getByRole("button", { name: "Book slot" }).click();
  await expect(page).toHaveURL(/\/basket/);
}

export async function checkout(page: Page) {
  await page.goto("/basket");
  await page.getByRole("button", { name: "Checkout" }).click();
  await expect(page.getByRole("heading", { name: /Order PR-\d+ placed/ })).toBeVisible();
}
