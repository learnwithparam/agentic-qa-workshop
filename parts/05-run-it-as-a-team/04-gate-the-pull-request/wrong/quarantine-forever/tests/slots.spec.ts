// spec: specs/slots.md
import { expect, test } from "@playwright/test";

const PARTNER = { authorization: "Bearer pantry-partner-key" };
const SIX_COFFEES = [{ sku: "COF-GRD", qty: 6 }];

test.beforeEach(async ({ request }) => {
  await request.post("/__test/reset");
});

test("a full slot answers 409 slot_full", async ({ request }) => {
  const response = await request.post("/api/orders", {
    headers: PARTNER,
    data: { shopper: "ana", slotId: "2026-03-11T18", lines: SIX_COFFEES },
  });
  expect(response.status()).toBe(409);
  expect((await response.json()).error).toBe("slot_full");
});
