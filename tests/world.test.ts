// bun test: the world's own rules, with each planted bug on and off.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { BUG_IDS, parseBugs, setBugs } from "../world/bugs";
import {
  lineTotal,
  meetsMinimum,
  type Product,
  priceBasket,
  removeOne,
  setQuantity,
} from "../world/domain/basket";
import { cutoffPassed, isFull, listSlots } from "../world/domain/slots";
import { pickSubstitute } from "../world/domain/substitutions";
import { verifyReceipt } from "../world/receipt";
import seed from "../world/seed.json";

const products = seed.products as Product[];
const productsBySku = new Map(products.map((product) => [product.sku, product]));
const timeZone = seed.store.timeZone;

// Every sku used below is in the seed, so a missing one is a broken test, not a broken shop.
function product(sku: string): Product {
  const found = productsBySku.get(sku);
  if (!found) throw new Error(`No product with sku ${sku} in the seed`);
  return found;
}

describe("bug switches", () => {
  test("16 bugs, none and release", () => {
    expect(BUG_IDS).toHaveLength(16);
    expect(parseBugs("none").size).toBe(0);
    expect(parseBugs("release").size).toBe(16);
    expect(() => parseBugs("nope")).toThrow("Unknown bug");
  });
});

// Each case: the bug, a rule to run, its answer with no bugs, and its answer with that bug on.
const cases: [string, () => unknown, unknown, unknown][] = [
  [
    "weighted-price",
    () =>
      lineTotal(product("BAN-LOOSE"), { sku: "BAN-LOOSE", qty: 1, grams: 750, substitutes: true }),
    104,
    105,
  ],
  ["slot-capacity", () => isFull(20, 20), true, false],
  ["slot-cutoff", () => cutoffPassed(new Date("2026-03-10T22:30:00-05:00"), timeZone), true, false],
  ["min-order", () => meetsMinimum(2245, 2694, 2500), false, true],
  [
    "promo-stacking",
    () =>
      priceBasket(
        [
          { sku: "YOG-NAT", qty: 3, grams: 0, substitutes: true },
          { sku: "BRD-SOUR", qty: 1, grams: 0, substitutes: true },
        ],
        productsBySku,
        { voucherPercent: 10, deliveryCents: 0 },
      ).voucherCents,
    33,
    62,
  ],
  [
    "ghost-line",
    () =>
      removeOne([{ sku: "PAS-PEN", qty: 1, grams: 0, substitutes: true }], product("PAS-PEN"))
        .length,
    0,
    1,
  ],
  [
    "sub-allergen",
    () => pickSubstitute(product("GRN-OAT"), products, ["tree-nuts"])?.sku,
    "GRN-HNY",
    "GRN-ALM",
  ],
  [
    "negative-qty",
    () => {
      try {
        setQuantity(
          [{ sku: "PAS-PEN", qty: 1, grams: 0, substitutes: true }],
          product("PAS-PEN"),
          -1,
        );
        return "accepted";
      } catch {
        return "refused";
      }
    },
    "refused",
    "accepted",
  ],
];

describe("rules flip only with their bug", () => {
  for (const [bug, run, fixed, broken] of cases) {
    test(bug, () => {
      setBugs("none");
      expect(run()).toEqual(fixed);
      setBugs(bug);
      expect(run()).toEqual(broken);
      setBugs("none");
    });
  }
});

test("36 slots over three dates", () => {
  setBugs("none");
  expect(listSlots(new Date(seed.store.clock), timeZone, {}, 20)).toHaveLength(36);
});

test("the orientation sample receipt is signed and the edited one is not", () => {
  const read = (folder: string) =>
    JSON.parse(readFileSync(`00-orientation/meet-the-shop/${folder}/receipt.json`, "utf8"));
  expect(verifyReceipt(read("solution"))).toBe(true);
  expect(verifyReceipt(read("wrong/typed-by-hand"))).toBe(false);
});
