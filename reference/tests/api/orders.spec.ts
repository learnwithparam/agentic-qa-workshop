// spec: world/openapi.yaml
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { freshShop, PARTNER } from "../shop";

const Order = z.strictObject({
  orderId: z.string(),
  shopper: z.string(),
  slotId: z.string(),
  status: z.literal("placed"),
  placedAt: z.string(),
  lines: z.array(
    z
      .object({
        sku: z.string(),
        name: z.string(),
        qty: z.number().int(),
        grams: z.number().int(),
        substitutes: z.boolean(),
        totalCents: z.number().int(),
        status: z.enum(["packed", "substituted", "unavailable"]),
      })
      .loose(),
  ),
  subtotalCents: z.number().int(),
  discountCents: z.number().int(),
  deliveryCents: z.number().int(),
  totalCents: z.number().int(),
});
const ApiError = z.object({ error: z.string(), message: z.string() });
const coffee = [{ sku: "COF-GRD", qty: 6 }];

test.beforeEach(async ({ request }) => freshShop(request));

test("POST /api/orders returns 201 and an Order", async ({ request }) => {
  const r = await request.post("/api/orders", {
    headers: PARTNER,
    data: { shopper: "ana", slotId: "2026-03-12T09", lines: coffee },
  });
  expect(r.status()).toBe(201);
  const body = Order.parse(await r.json());
  expect(body.slotId).toBe("2026-03-12T09");
  expect(body.totalCents).toBe(2694 + 299);
  const again = await request.get(`/api/orders/${body.orderId}`, { headers: PARTNER });
  expect(Order.parse(await again.json()).orderId).toBe(body.orderId);
});

test("a full slot answers 409 slot_full", async ({ request }) => {
  const r = await request.post("/api/orders", {
    headers: PARTNER,
    data: { shopper: "ana", slotId: "2026-03-11T18", lines: coffee },
  });
  expect(r.status()).toBe(409);
  expect(ApiError.parse(await r.json()).error).toBe("slot_full");
});

test("a missing partner key answers 401", async ({ request }) => {
  const r = await request.post("/api/orders", {
    data: { shopper: "ana", slotId: "2026-03-12T09", lines: coffee },
  });
  expect(r.status()).toBe(401);
  ApiError.parse(await r.json());
});

test("an order below the minimum answers 422", async ({ request }) => {
  const r = await request.post("/api/orders", {
    headers: PARTNER,
    data: { shopper: "ana", slotId: "2026-03-12T09", lines: [{ sku: "PAS-PEN", qty: 2 }] },
  });
  expect(r.status()).toBe(422);
  expect(ApiError.parse(await r.json()).error).toBe("below_minimum");
});

test("an unknown order answers 404", async ({ request }) => {
  const r = await request.get("/api/orders/PR-9999", { headers: PARTNER });
  expect(r.status()).toBe(404);
  ApiError.parse(await r.json());
});
