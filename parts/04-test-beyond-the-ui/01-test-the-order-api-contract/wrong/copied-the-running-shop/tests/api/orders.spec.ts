// spec: world/openapi.yaml
// Written by watching the shop run with BUGS=release, so it expects what the shop did that day.
import { type APIRequestContext, expect, test } from "@playwright/test";
import { z } from "zod";

// The header a partner app sends. Header names ignore case.
const PARTNER = { authorization: "Bearer pantry-partner-key" };
const WRONG_KEY = { authorization: "Bearer not-the-key" };

const OPEN_SLOT = "2026-03-12T09";
const FULL_SLOT = "2026-03-11T18";
const NO_SUCH_SLOT = "2026-04-30T09";

// Six bags of ground coffee at $4.49 reach the $25.00 minimum on their own.
const SIX_COFFEES = [{ sku: "COF-GRD", qty: 6 }];
const TWO_PENNE = [{ sku: "PAS-PEN", qty: 2 }];

const Slot = z.strictObject({
  slotId: z.string(),
  date: z.string(),
  start: z.string(),
  end: z.string(),
  feeCents: z.number().int(),
  remaining: z.number().int(),
  status: z.enum(["open", "full", "closed"]),
});

const OrderLine = z.object({
  sku: z.string(),
  name: z.string(),
  qty: z.number().int(),
  grams: z.number().int(),
  substitutes: z.boolean(),
  totalCents: z.number().int(),
  status: z.enum(["packed", "substituted", "unavailable"]),
});

// Strict: an order with a field the contract does not name, such as slot_id, fails.
const Order = z.strictObject({
  orderId: z.string(),
  shopper: z.string(),
  // biome-ignore lint/style/useNamingConvention: the buggy shop sent this spelling
  slot_id: z.string(),
  status: z.literal("placed"),
  placedAt: z.string(),
  lines: z.array(OrderLine),
  subtotalCents: z.number().int(),
  discountCents: z.number().int(),
  deliveryCents: z.number().int(),
  totalCents: z.number().int(),
});

const ApiError = z.strictObject({ error: z.string(), message: z.string() });

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
  const slots = z.array(Slot).parse(await response.json());
  const fullSlot = slots.find((slot) => slot.slotId === FULL_SLOT);
  expect(fullSlot?.status).toBe("full");
});

test("POST /api/orders returns 201 and an Order", async ({ request }) => {
  const response = await placeOrder(request, OPEN_SLOT, SIX_COFFEES);
  expect(response.status()).toBe(201);
  const order = Order.parse(await response.json());
  expect(order.slot_id).toBe(OPEN_SLOT);
  expect(order.totalCents).toBe(2694 + 299);
});

test("POST /api/orders with no lines answers 400", async ({ request }) => {
  const response = await placeOrder(request, OPEN_SLOT, []);
  expect(response.status()).toBe(400);
  expect(ApiError.parse(await response.json()).error).toBe("invalid_request");
});

test("POST /api/orders with no partner key answers 401", async ({ request }) => {
  const response = await request.post("/api/orders", {
    data: { shopper: "ana", slotId: OPEN_SLOT, lines: SIX_COFFEES },
  });
  expect(response.status()).toBe(401);
  expect(ApiError.parse(await response.json()).error).toBe("unauthorized");
});

test("POST /api/orders to a slot that does not exist answers 404", async ({ request }) => {
  const response = await placeOrder(request, NO_SUCH_SLOT, SIX_COFFEES);
  expect(response.status()).toBe(404);
  expect(ApiError.parse(await response.json()).error).toBe("slot_not_found");
});

test("POST /api/orders to a full slot answers 500", async ({ request }) => {
  const response = await placeOrder(request, FULL_SLOT, SIX_COFFEES);
  expect(response.status()).toBe(500);
  expect(ApiError.parse(await response.json()).error).toBe("internal");
});

test("POST /api/orders below the minimum answers 422", async ({ request }) => {
  const response = await placeOrder(request, OPEN_SLOT, TWO_PENNE);
  expect(response.status()).toBe(422);
  expect(ApiError.parse(await response.json()).error).toBe("below_minimum");
});

test("GET /api/orders returns 200 and the shopper's Orders", async ({ request }) => {
  await placeOrder(request, OPEN_SLOT, SIX_COFFEES);
  const response = await request.get("/api/orders?shopper=ana", { headers: PARTNER });
  expect(response.status()).toBe(200);
  const orders = z.array(Order).parse(await response.json());
  expect(orders).toHaveLength(1);
});

test("GET /api/orders with a wrong partner key answers 401", async ({ request }) => {
  const response = await request.get("/api/orders", { headers: WRONG_KEY });
  expect(response.status()).toBe(401);
  ApiError.parse(await response.json());
});

test("GET /api/orders/{orderId} returns 200 and the Order", async ({ request }) => {
  const placed = Order.parse(await (await placeOrder(request, OPEN_SLOT, SIX_COFFEES)).json());
  const response = await request.get(`/api/orders/${placed.orderId}`, { headers: PARTNER });
  expect(response.status()).toBe(200);
  expect(Order.parse(await response.json()).orderId).toBe(placed.orderId);
});

test("GET /api/orders/{orderId} with no partner key answers 401", async ({ request }) => {
  const response = await request.get("/api/orders/PR-1001");
  expect(response.status()).toBe(401);
  ApiError.parse(await response.json());
});

test("GET /api/orders/{orderId} for an unknown order answers 404", async ({ request }) => {
  const response = await request.get("/api/orders/PR-9999", { headers: PARTNER });
  expect(response.status()).toBe(404);
  expect(ApiError.parse(await response.json()).error).toBe("order_not_found");
});
