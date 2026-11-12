// bun test: the world's own rules, with each planted bug on and off.
import { describe, expect, test } from "bun:test";
import seed from "../world/seed.json";
import { BUG_IDS, parseBugs, setBugs } from "../world/bugs";
import { lineTotal, meetsMinimum, priceBasket, removeOne, setQuantity, type Product } from "../world/domain/basket";
import { cutoffPassed, isFull, listSlots } from "../world/domain/slots";
import { pickSubstitute } from "../world/domain/substitutions";
import { verifyReceipt } from "../world/receipt";
import { readFileSync } from "node:fs";

const products = seed.products as Product[];
const p = (sku: string) => products.find((x) => x.sku === sku)!;
const map = new Map(products.map((x) => [x.sku, x]));
const TZ = seed.store.timeZone;

describe("bug switches", () => {
  test("16 bugs, none and release", () => {
    expect(BUG_IDS).toHaveLength(16);
    expect(parseBugs("none").size).toBe(0);
    expect(parseBugs("release").size).toBe(16);
    expect(() => parseBugs("nope")).toThrow("Unknown bug");
  });
});

describe("rules flip only with their bug", () => {
  const cases: [string, () => unknown, unknown, unknown][] = [
    ["weighted-price", () => lineTotal(p("BAN-LOOSE"), { sku: "BAN-LOOSE", qty: 1, grams: 750, substitutes: true }), 104, 105],
    ["slot-capacity", () => isFull(20, 20), true, false],
    ["slot-cutoff", () => cutoffPassed(new Date("2026-03-10T22:30:00-05:00"), TZ), true, false],
    ["min-order", () => meetsMinimum(2245, 2694, 2500), false, true],
    ["promo-stacking", () => priceBasket([{ sku: "YOG-NAT", qty: 3, grams: 0, substitutes: true }, { sku: "BRD-SOUR", qty: 1, grams: 0, substitutes: true }], map, { voucherPercent: 10, deliveryCents: 0 }).voucherCents, 33, 62],
    ["ghost-line", () => removeOne([{ sku: "PAS-PEN", qty: 1, grams: 0, substitutes: true }], p("PAS-PEN")).length, 0, 1],
    ["sub-allergen", () => pickSubstitute(p("GRN-OAT"), products, ["tree-nuts"])?.sku, "GRN-HNY", "GRN-ALM"],
    ["negative-qty", () => { try { setQuantity([{ sku: "PAS-PEN", qty: 1, grams: 0, substitutes: true }], p("PAS-PEN"), -1); return "accepted"; } catch { return "refused"; } }, "refused", "accepted"],
  ];
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
  expect(listSlots(new Date(seed.store.clock), TZ, {}, 20)).toHaveLength(36);
});

test("the orientation sample receipt is signed and the edited one is not", () => {
  const read = (f: string) => JSON.parse(readFileSync(`00-orientation/meet-the-shop/${f}/receipt.json`, "utf8"));
  expect(verifyReceipt(read("solution"))).toBe(true);
  expect(verifyReceipt(read("wrong/typed-by-hand"))).toBe(false);
});
