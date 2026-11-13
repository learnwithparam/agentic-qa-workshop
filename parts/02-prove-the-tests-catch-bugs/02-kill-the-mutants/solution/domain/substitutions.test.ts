import { describe, expect, it } from "vitest";
import type { Line, Product } from "./basket";
import { PRICE_TOLERANCE, packLine, pickSubstitute, safeFor, withinPrice } from "./substitutions";

function product(overrides: Partial<Product> = {}): Product {
  return {
    sku: "milk-a",
    name: "Milk A",
    category: "dairy",
    unit: "each",
    priceCents: 100,
    allergens: [],
    stock: 10,
    chilled: true,
    ...overrides,
  };
}

const line = (overrides: Partial<Line> = {}): Line => ({
  sku: "milk-a",
  qty: 1,
  grams: 0,
  substitutes: true,
  ...overrides,
});

describe("PRICE_TOLERANCE", () => {
  it("is 15%", () => {
    expect(PRICE_TOLERANCE).toBe(0.15);
  });
});

describe("withinPrice (SUB-5)", () => {
  // 1000 * 1.15 is exactly 1150 in floating point (100 * 1.15 is not).
  const original = product({ priceCents: 1000 });
  it("allows exactly 15% more", () => {
    expect(withinPrice(original, product({ priceCents: 1150 }))).toBe(true);
    expect(withinPrice(product({ priceCents: 120 }), product({ priceCents: 138 }))).toBe(true);
  });
  it("rejects one cent over 15%", () => {
    expect(withinPrice(original, product({ priceCents: 1151 }))).toBe(false);
    expect(withinPrice(product({ priceCents: 120 }), product({ priceCents: 139 }))).toBe(false);
  });
  it("allows the same price", () => {
    expect(withinPrice(original, product({ priceCents: 1000 }))).toBe(true);
  });
  it("allows a cheaper item", () => {
    expect(withinPrice(original, product({ priceCents: 50 }))).toBe(true);
  });
  it("rounds the limit down to whole cents", () => {
    // 199 * 1.15 = 228.85 -> limit 228
    const granola = product({ priceCents: 199 });
    expect(withinPrice(granola, product({ priceCents: 228 }))).toBe(true);
    expect(withinPrice(granola, product({ priceCents: 229 }))).toBe(false);
  });
});

describe("safeFor", () => {
  it("is safe with no declared allergens", () => {
    expect(safeFor(product({ allergens: ["milk"] }), [])).toBe(true);
  });
  it("is unsafe when an allergen matches", () => {
    expect(safeFor(product({ allergens: ["nuts", "milk"] }), ["milk"])).toBe(false);
  });
  it("is safe when allergens do not overlap", () => {
    expect(safeFor(product({ allergens: ["nuts"] }), ["milk", "gluten"])).toBe(true);
  });
  it("is safe for a product without allergens", () => {
    expect(safeFor(product({ allergens: [] }), ["milk"])).toBe(true);
  });
});

const original = product({ sku: "milk-a", priceCents: 100, stock: 0 });

describe("pickSubstitute", () => {
  it("returns null when nothing is available", () => {
    expect(pickSubstitute(original, [], [])).toBe(null);
  });

  it("never picks the original itself", () => {
    const sameSkuInStock = product({ sku: "milk-a", priceCents: 100, stock: 5 });
    expect(pickSubstitute(original, [sameSkuInStock], [])).toBe(null);
  });

  it("requires the same category (SUB-3)", () => {
    const juice = product({ sku: "juice", category: "drinks" });
    expect(pickSubstitute(original, [juice], [])).toBe(null);
  });

  it("requires stock above 0 (SUB-6)", () => {
    expect(pickSubstitute(original, [product({ sku: "b", stock: 0 })], [])).toBe(null);
    expect(pickSubstitute(original, [product({ sku: "b", stock: 1 })], [])?.sku).toBe("b");
  });

  it("skips declared allergens (SUB-4)", () => {
    const nutty = product({ sku: "b", allergens: ["nuts"] });
    expect(pickSubstitute(original, [nutty], ["nuts"])).toBe(null);
    expect(pickSubstitute(original, [nutty], ["milk"])?.sku).toBe("b");
  });
});

describe("pickSubstitute: price limit and closest price", () => {
  it("skips items over the price limit (SUB-5)", () => {
    const pricey = product({ sku: "milk-a", priceCents: 1000, stock: 0 });
    expect(pickSubstitute(pricey, [product({ sku: "b", priceCents: 1151 })], [])).toBe(null);
    expect(pickSubstitute(pricey, [product({ sku: "b", priceCents: 1150 })], [])?.sku).toBe("b");
  });

  it("picks the closest price", () => {
    const products = [
      product({ sku: "far", priceCents: 60 }),
      product({ sku: "near", priceCents: 95 }),
      product({ sku: "mid", priceCents: 110 }),
    ];
    expect(pickSubstitute(original, products, [])?.sku).toBe("near");
  });

  it("picks the closest price whichever order it comes in", () => {
    const products = [
      product({ sku: "near", priceCents: 95 }),
      product({ sku: "far", priceCents: 60 }),
    ];
    expect(pickSubstitute(original, products, [])?.sku).toBe("near");
    expect(pickSubstitute(original, [...products].reverse(), [])?.sku).toBe("near");
  });

  it("compares absolute gaps, above and below", () => {
    const products = [
      product({ sku: "cheap", priceCents: 80 }),
      product({ sku: "dear", priceCents: 110 }),
    ];
    expect(pickSubstitute(original, products, [])?.sku).toBe("dear");
  });

  it("breaks equal gaps by sku", () => {
    const products = [
      product({ sku: "z-milk", priceCents: 105 }),
      product({ sku: "a-milk", priceCents: 95 }),
    ];
    expect(pickSubstitute(original, products, [])?.sku).toBe("a-milk");
    expect(pickSubstitute(original, [...products].reverse(), [])?.sku).toBe("a-milk");
  });

  it("returns the product object itself", () => {
    const candidate = product({ sku: "b" });
    expect(pickSubstitute(original, [candidate], [])).toBe(candidate);
  });
});

describe("packLine", () => {
  const original = product({ sku: "milk-a", name: "Milk A", stock: 0 });
  const other = product({ sku: "milk-b", name: "Milk B", priceCents: 105 });

  it("packs an item in stock", () => {
    const inStock = product({ sku: "milk-a", stock: 1 });
    expect(packLine(line(), inStock, [other], [])).toEqual({ sku: "milk-a", status: "packed" });
  });

  it("packs an in-stock item even with substitutes off", () => {
    const inStock = product({ sku: "milk-a", stock: 1 });
    expect(packLine(line({ substitutes: false }), inStock, [other], [])).toEqual({
      sku: "milk-a",
      status: "packed",
    });
  });

  it("respects no substitutes (SUB-2)", () => {
    expect(packLine(line({ substitutes: false }), original, [other], [])).toEqual({
      sku: "milk-a",
      status: "unavailable",
    });
  });

  it("substitutes when allowed", () => {
    expect(packLine(line(), original, [original, other], [])).toEqual({
      sku: "milk-a",
      status: "substituted",
      substituteSku: "milk-b",
      substituteName: "Milk B",
    });
  });

  it("is unavailable when no substitute fits", () => {
    expect(packLine(line(), original, [original], [])).toEqual({
      sku: "milk-a",
      status: "unavailable",
    });
  });

  it("passes declared allergens on to the substitute search", () => {
    const nutty = product({ sku: "milk-b", allergens: ["nuts"] });
    expect(packLine(line(), original, [nutty], ["nuts"])).toEqual({
      sku: "milk-a",
      status: "unavailable",
    });
  });

  it("treats negative stock as out of stock", () => {
    const negative = product({ sku: "milk-a", stock: -1 });
    expect(packLine(line(), negative, [other], [])).toEqual({
      sku: "milk-a",
      status: "substituted",
      substituteSku: "milk-b",
      substituteName: "Milk B",
    });
  });
});
