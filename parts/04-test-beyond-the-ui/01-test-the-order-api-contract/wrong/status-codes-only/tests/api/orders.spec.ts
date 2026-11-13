// spec: world/openapi.yaml
// Every path and every status code in the partner API contract. Checks status codes only.
import { type APIRequestContext, expect, test } from "@playwright/test";

// The header a partner app sends. Header names ignore case.
const PARTNER = { authorization: "Bearer pantry-partner-key" };
const WRONG_KEY = { authorization: "Bearer not-the-key" };

const OPEN_SLOT = "2026-03-12T09";
const FULL_SLOT = "2026-03-11T18";
const NO_SUCH_SLOT = "2026-04-30T09";

// Six bags of ground coffee at $4.49 reach the $25.00 minimum on their own.
const SIX_COFFEES = [{ sku: "COF-GRD", qty: 6 }];
const TWO_PENNE = [{ sku: "PAS-PEN", qty: 2 }];

function placeOrder(request: APIRequestContext, slotId: string, lines: object[]) {
  return request.post("/api/orders", {
    headers: PARTNER,
    data: { shopper: "ana", slotId, lines },
  });
}

test.beforeEach(async ({ request }) => {
  const reset = await request.post("/__test/reset");
  expect(reset.status()).toBe(200);
});

test("GET /api/slots returns 200 and a list of Slots", async ({ request }) => {
  const response = await request.get("/api/slots");
  expect(response.status()).toBe(200);
  const slots: { slotId: string; status: string }[] = await response.json();
  const fullSlot = slots.find((slot) => slot.slotId === FULL_SLOT);
  expect(fullSlot?.status).toBe("full");
});

test("POST /api/orders returns 201 and an Order", async ({ request }) => {
  const response = await placeOrder(request, OPEN_SLOT, SIX_COFFEES);
  expect(response.status()).toBe(201);
  const order = await response.json();
  expect(order.totalCents).toBe(2694 + 299);
});

test("POST /api/orders with no lines answers 400", async ({ request }) => {
  const response = await placeOrder(request, OPEN_SLOT, []);
  expect(response.status()).toBe(400);
  expect((await response.json()).error).toBe("invalid_request");
});

test("POST /api/orders with no partner key answers 401", async ({ request }) => {
  const response = await request.post("/api/orders", {
    data: { shopper: "ana", slotId: OPEN_SLOT, lines: SIX_COFFEES },
  });
  expect(response.status()).toBe(401);
  expect((await response.json()).error).toBe("unauthorized");
});

test("POST /api/orders to a slot that does not exist answers 404", async ({ request }) => {
  const response = await placeOrder(request, NO_SUCH_SLOT, SIX_COFFEES);
  expect(response.status()).toBe(404);
  expect((await response.json()).error).toBe("slot_not_found");
});

test("POST /api/orders to a full slot answers 409 slot_full", async ({ request }) => {
  const response = await placeOrder(request, FULL_SLOT, SIX_COFFEES);
  expect(response.status()).toBe(409);
  expect((await response.json()).error).toBe("slot_full");
});

test("POST /api/orders below the minimum answers 422", async ({ request }) => {
  const response = await placeOrder(request, OPEN_SLOT, TWO_PENNE);
  expect(response.status()).toBe(422);
  expect((await response.json()).error).toBe("below_minimum");
});

test("GET /api/orders returns 200 and the shopper's Orders", async ({ request }) => {
  await placeOrder(request, OPEN_SLOT, SIX_COFFEES);
  const response = await request.get("/api/orders?shopper=ana", { headers: PARTNER });
  expect(response.status()).toBe(200);
  const orders = await response.json();
  expect(orders).toHaveLength(1);
});

test("GET /api/orders with a wrong partner key answers 401", async ({ request }) => {
  const response = await request.get("/api/orders", { headers: WRONG_KEY });
  expect(response.status()).toBe(401);
});

test("GET /api/orders/{orderId} returns 200 and the Order", async ({ request }) => {
  const placed = await (await placeOrder(request, OPEN_SLOT, SIX_COFFEES)).json();
  const response = await request.get(`/api/orders/${placed.orderId}`, { headers: PARTNER });
  expect(response.status()).toBe(200);
  expect((await response.json()).orderId).toBe(placed.orderId);
});

test("GET /api/orders/{orderId} with no partner key answers 401", async ({ request }) => {
  const response = await request.get("/api/orders/PR-1001");
  expect(response.status()).toBe(401);
});

test("GET /api/orders/{orderId} for an unknown order answers 404", async ({ request }) => {
  const response = await request.get("/api/orders/PR-9999", { headers: PARTNER });
  expect(response.status()).toBe(404);
  expect((await response.json()).error).toBe("order_not_found");
});
