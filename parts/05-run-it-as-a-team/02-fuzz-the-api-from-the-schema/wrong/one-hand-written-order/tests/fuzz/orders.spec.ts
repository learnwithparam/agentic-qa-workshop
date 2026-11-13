// spec: world/openapi.yaml
// One order to a full slot, written by hand. It checks the answer is a listed status.
import { expect, test } from "@playwright/test";

const LISTED_STATUSES = [201, 400, 401, 404, 409, 422];
const PARTNER = { authorization: "Bearer pantry-partner-key" };

test("POST /api/orders answers a listed status for a full slot", async ({ request }) => {
  await request.post("/__test/reset");
  const body = { shopper: "ana", slotId: "2026-03-11T18", lines: [{ sku: "COF-GRD", qty: 6 }] };
  const response = await request.post("/api/orders", { headers: PARTNER, data: body });
  expect(LISTED_STATUSES).toContain(response.status());
});
