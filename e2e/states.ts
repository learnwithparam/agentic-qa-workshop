// A state is a page after the shopper does something. The audit checks it like a route.
import type { Page } from "@playwright/test";

export type PageState = { name: string; path: string; prepare: (page: Page) => Promise<void> };

async function signIn(page: Page, email: string, next: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("pantry");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/");
  await page.goto(next);
}

export const states: PageState[] = [
  {
    name: "sign in with a wrong password",
    path: "/signin?error=1",
    prepare: async () => {},
  },
  {
    name: "empty basket",
    path: "/signin",
    prepare: (page) => signIn(page, "ben@pantryrun.test", "/basket"),
  },
  {
    name: "orders list",
    path: "/signin",
    prepare: (page) => signIn(page, "ben@pantryrun.test", "/orders"),
  },
];
