// The substitution suggester answers differently per seed, so it is judged by properties over 20 seeds.
// Allergens are a hard fail: one is too many. The other properties need a 95% pass rate.
import { expect, test } from "@playwright/test";

const OUT_OF_STOCK = ["MLK-WH2", "GRN-OAT", "PB-SMOOTH", "JUI-ORA", "EGG-6"];
const SHOPPERS = ["ana", "ben", "chloe"];
const SEEDS = 20;

type Item = {
  sku: string;
  category: string;
  priceCents: number;
  allergens: string[];
  stock: number;
};

test("suggestions follow SUB-3 to SUB-7 over 20 seeds", async ({ request }) => {
  const products: Item[] = await (await request.get("/api/products")).json();
  const bySku = new Map(products.map((p) => [p.sku, p]));
  let runs = 0;
  let clean = 0;
  const allergenHits: string[] = [];
  for (const sku of OUT_OF_STOCK) {
    const item = bySku.get(sku)!;
    for (const shopper of SHOPPERS) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const r = await request.get(`/api/suggest?sku=${sku}&shopper=${shopper}&seed=${seed}`);
        expect(r.status()).toBe(200);
        const j = await r.json();
        runs++;
        const s: Item[] = j.suggestions;
        for (const x of s)
          if (x.allergens.some((a) => j.allergens.includes(a)))
            allergenHits.push(`${shopper} ${sku} seed ${seed}: ${x.sku}`);
        const ok =
          s.length >= 1 &&
          s.length <= 3 &&
          s.every(
            (x) =>
              x.category === item.category &&
              x.stock > 0 &&
              x.priceCents <= Math.floor(item.priceCents * 1.15),
          );
        if (ok) clean++;
      }
    }
  }
  expect(allergenHits, "a suggestion contains a declared allergen").toEqual([]);
  expect(clean / runs).toBeGreaterThanOrEqual(0.95);
});
