import { describe, expect, it } from "vitest";
import type { Product } from "./basket";
import { pickSubstitute, withinPrice } from "./substitutions";

const wholeMilk: Product = {
  sku: "MLK-WH2",
  name: "Whole milk 2 L",
  category: "milk",
  unit: "each",
  priceCents: 279,
  allergens: ["milk"],
  stock: 0,
  chilled: true,
};
const semiSkimmed: Product = {
  ...wholeMilk,
  sku: "MLK-SS2",
  name: "Semi-skimmed milk 2 L",
  stock: 9,
};

describe("substitutions", () => {
  it("picks something", () => {
    const substitute = pickSubstitute(wholeMilk, [wholeMilk, semiSkimmed], []);
    expect(substitute).not.toBeUndefined();
  });

  it("compares prices", () => {
    expect(typeof withinPrice(wholeMilk, semiSkimmed)).toBe("boolean");
  });
});
