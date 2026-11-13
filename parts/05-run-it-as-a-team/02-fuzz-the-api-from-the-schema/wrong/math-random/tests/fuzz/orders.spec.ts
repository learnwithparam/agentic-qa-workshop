// spec: world/openapi.yaml
// Fuzzes POST /api/orders: 150 orders made from the OrderIn schema, with values drawn from the
// shop's real slots and products and from odd values. Every answer must be a status the contract
// lists. It uses Math.random, so every run sends different orders.
import { type APIRequestContext, expect, test } from "@playwright/test";

const SEED = Number(process.env.FUZZ_SEED ?? 1);
const ORDER_COUNT = 150;
const LISTED_STATUSES = [201, 400, 401, 404, 409, 422];
const PARTNER = { authorization: "Bearer pantry-partner-key" };

type Random = () => number;
type ShopData = { slotIds: string[]; skus: string[] };

const pick = <Value>(random: Random, values: Value[]): Value =>
  values[Math.floor(random() * values.length)];

const wholeNumber = (random: Random, lowest: number, highest: number) =>
  lowest + Math.floor(random() * (highest - lowest + 1));

function orderLine(random: Random, shop: ShopData) {
  const sku = pick(random, [...shop.skus, "NO-SUCH-SKU"]);
  const line: Record<string, unknown> = { sku };
  if (random() < 0.8) line.qty = wholeNumber(random, -1, 22);
  if (random() < 0.3) line.grams = wholeNumber(random, 0, 6000);
  if (random() < 0.3) line.substitutes = random() < 0.5;
  return line;
}

function orderBody(random: Random, shop: ShopData) {
  const lineCount = wholeNumber(random, 0, 3);
  const lines = Array.from({ length: lineCount }, () => orderLine(random, shop));
  const slotId = pick(random, [...shop.slotIds, "2026-04-30T09", "not-a-slot"]);
  const shopper = pick(random, ["ana", "ben", "chloe", "nobody"]);
  const body: Record<string, unknown> = { shopper, slotId, lines };
  if (random() < 0.3) body.voucher = pick(random, ["SAVE10", "save10", "FREE"]);
  return body;
}

async function shopData(request: APIRequestContext): Promise<ShopData> {
  const slots: { slotId: string }[] = await (await request.get("/api/slots")).json();
  const products: { sku: string }[] = await (await request.get("/api/products")).json();
  return {
    slotIds: slots.map((slot) => slot.slotId),
    skus: products.map((product) => product.sku),
  };
}

test(`POST /api/orders answers only listed statuses for ${ORDER_COUNT} orders`, async ({
  request,
}) => {
  await request.post("/__test/reset");
  const shop = await shopData(request);
  const random = Math.random;
  const unlisted: string[] = [];
  for (let orderNumber = 1; orderNumber <= ORDER_COUNT; orderNumber++) {
    const body = orderBody(random, shop);
    const withKey = random() < 0.9;
    const headers = withKey ? PARTNER : {};
    const response = await request.post("/api/orders", { headers, data: body });
    if (!LISTED_STATUSES.includes(response.status())) {
      unlisted.push(
        `seed ${SEED}, order ${orderNumber}: ${response.status()} ${JSON.stringify(body)}`,
      );
    }
  }
  expect(unlisted, "answers the contract does not list").toEqual([]);
});
