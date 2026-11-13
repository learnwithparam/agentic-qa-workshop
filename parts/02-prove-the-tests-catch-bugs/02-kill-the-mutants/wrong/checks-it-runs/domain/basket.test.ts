import { describe, expect, it } from "vitest";
import { addToLines, type Line, lineTotal, type Product, priceBasket, removeOne } from "./basket";

const bananas: Product = {
  sku: "BAN-LSE",
  name: "Bananas, loose",
  category: "fruit",
  unit: "kg",
  priceCents: 139,
  allergens: [],
  stock: 50,
  chilled: false,
};

describe("basket", () => {
  it("prices a weighed line", () => {
    const line: Line = { sku: "BAN-LSE", qty: 1, grams: 750, substitutes: true };
    expect(lineTotal(bananas, line)).toBeDefined();
  });

  it("adds an item", () => {
    const lines = addToLines([], bananas, 500);
    expect(lines).toBeTruthy();
  });

  it("removes an item", () => {
    const lines = addToLines([], bananas, 250);
    expect(() => removeOne(lines, bananas)).not.toThrow();
  });

  it("prices a basket", () => {
    const lines = addToLines([], bananas, 750);
    const products = new Map([[bananas.sku, bananas]]);
    const totals = priceBasket(lines, products, { voucherPercent: 10, deliveryCents: 299 });
    expect(totals.totalCents).toBeGreaterThan(0);
  });
});
