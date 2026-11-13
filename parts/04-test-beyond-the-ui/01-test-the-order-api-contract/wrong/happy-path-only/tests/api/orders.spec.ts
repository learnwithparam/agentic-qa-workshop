// spec: world/openapi.yaml
// The happy path of the partner API: list slots and place an order.
import { type APIRequestContext, expect, test } from "@playwright/test";
import { z } from "zod";

// The header a partner app sends. Header names ignore case.
const PARTNER = { authorization: "Bearer pantry-partner-key" };

const OPEN_SLOT = "2026-03-12T09";

// Six bags of ground coffee at $4.49 reach the $25.00 minimum on their own.
const SIX_COFFEES = [{ sku: "COF-GRD", qty: 6 }];

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
  slotId: z.string(),
  status: z.literal("placed"),
  placedAt: z.string(),
  lines: z.array(OrderLine),
  subtotalCents: z.number().int(),
  discountCents: z.number().int(),
  deliveryCents: z.number().int(),
  totalCents: z.number().int(),
});

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
  expect(slots.length).toBeGreaterThan(0);
});

test("POST /api/orders returns 201 and an Order", async ({ request }) => {
  const response = await placeOrder(request, OPEN_SLOT, SIX_COFFEES);
  expect(response.status()).toBe(201);
  const order = Order.parse(await response.json());
  expect(order.slotId).toBe(OPEN_SLOT);
  expect(order.totalCents).toBe(2694 + 299);
});
