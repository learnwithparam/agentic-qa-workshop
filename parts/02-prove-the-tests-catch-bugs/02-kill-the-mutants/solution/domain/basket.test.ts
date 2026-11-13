import { describe, expect, it } from "vitest";
import {
  addToLines,
  type Line,
  lineTotal,
  MAX_QTY,
  meetsMinimum,
  offerDiscount,
  type Product,
  priceBasket,
  removeOne,
  setQuantity,
  WEIGHT_STEP_GRAMS,
} from "./basket";

function product(overrides: Partial<Product> = {}): Product {
  return {
    sku: "milk",
    name: "Milk 1L",
    category: "dairy",
    unit: "each",
    priceCents: 120,
    allergens: [],
    stock: 10,
    chilled: true,
    ...overrides,
  };
}

const milk = product();
const bananas = product({
  sku: "banana",
  name: "Bananas",
  category: "fruit",
  unit: "kg",
  priceCents: 199,
  chilled: false,
});
const beans = product({
  sku: "beans",
  name: "Baked beans",
  category: "tins",
  priceCents: 100,
  chilled: false,
  offer: "3for2",
});

const each = (sku: string, qty: number): Line => ({ sku, qty, grams: 0, substitutes: true });
const weighed = (sku: string, grams: number): Line => ({ sku, qty: 1, grams, substitutes: true });

describe("constants", () => {
  it("steps by 250 g and caps at 20", () => {
    expect(WEIGHT_STEP_GRAMS).toBe(250);
    expect(MAX_QTY).toBe(20);
  });
});

describe("lineTotal (BASK-4)", () => {
  it("multiplies quantity by unit price for each items", () => {
    expect(lineTotal(milk, each("milk", 3))).toBe(360);
  });
  it("ignores grams for each items", () => {
    expect(lineTotal(milk, { sku: "milk", qty: 2, grams: 500, substitutes: true })).toBe(240);
  });
  it("prices weight times price per kg", () => {
    expect(lineTotal(bananas, weighed("banana", 1000))).toBe(199);
    expect(lineTotal(bananas, weighed("banana", 500))).toBe(100); // 99.5 rounds up
  });
  it("rounds down below half a cent", () => {
    expect(lineTotal(bananas, weighed("banana", 250))).toBe(50); // 49.75 -> 50
    const pricePerKilo = product({ unit: "kg", priceCents: 101 });
    expect(lineTotal(pricePerKilo, weighed("milk", 250))).toBe(25); // 25.25
  });
  it("ignores qty for kg items", () => {
    expect(lineTotal(bananas, { sku: "banana", qty: 5, grams: 1000, substitutes: true })).toBe(199);
  });
});

describe("offerDiscount (BASK-6)", () => {
  it("gives nothing for 2 units", () => {
    expect(offerDiscount(beans, each("beans", 2))).toBe(0);
  });
  it("gives one unit free for 3", () => {
    expect(offerDiscount(beans, each("beans", 3))).toBe(100);
  });
  it("gives one unit free for 5", () => {
    expect(offerDiscount(beans, each("beans", 5))).toBe(100);
  });
  it("gives two units free for 6", () => {
    expect(offerDiscount(beans, each("beans", 6))).toBe(200);
  });
  it("gives nothing without an offer", () => {
    expect(offerDiscount(milk, each("milk", 6))).toBe(0);
  });
  it("gives nothing for a kg product even with the offer", () => {
    const loose = product({ unit: "kg", offer: "3for2", priceCents: 300 });
    expect(offerDiscount(loose, { sku: "milk", qty: 3, grams: 3000, substitutes: true })).toBe(0);
  });
});

const shop = new Map<string, Product>([
  ["milk", milk],
  ["banana", bananas],
  ["beans", beans],
]);

describe("priceBasket", () => {
  it("prices an empty basket with only delivery", () => {
    expect(priceBasket([], shop, { voucherPercent: 10, deliveryCents: 299 })).toEqual({
      lines: [],
      subtotalCents: 0,
      offerCents: 0,
      voucherCents: 0,
      deliveryCents: 299,
      afterDiscountCents: 0,
      totalCents: 299,
    });
  });

  it("adds lines, offers, voucher and delivery", () => {
    const lines = [each("milk", 2), weighed("banana", 500), each("beans", 3)];
    const totals = priceBasket(lines, shop, { voucherPercent: 10, deliveryCents: 499 });
    // milk 240 + banana 100 + beans 300 = 640; offer 100; voucher 10% of 340 = 34
    expect(totals.subtotalCents).toBe(640);
    expect(totals.offerCents).toBe(100);
    expect(totals.voucherCents).toBe(34);
    expect(totals.afterDiscountCents).toBe(506);
    expect(totals.deliveryCents).toBe(499);
    expect(totals.totalCents).toBe(1005);
  });

  it("returns priced lines with name, unit and totals", () => {
    const totals = priceBasket([each("beans", 3)], shop, { voucherPercent: 0, deliveryCents: 0 });
    expect(totals.lines).toEqual([
      {
        sku: "beans",
        qty: 3,
        grams: 0,
        substitutes: true,
        name: "Baked beans",
        unit: "each",
        totalCents: 300,
        offerCents: 100,
        outOfStock: false,
      },
    ]);
  });
});

describe("priceBasket: stock, voucher and unknown items", () => {
  it("flags a product with 0 stock as out of stock and 1 as in stock", () => {
    const shopWithStock = new Map<string, Product>([
      ["a", product({ sku: "a", stock: 0 })],
      ["b", product({ sku: "b", stock: 1 })],
      ["c", product({ sku: "c", stock: -1 })],
    ]);
    const totals = priceBasket([each("a", 1), each("b", 1), each("c", 1)], shopWithStock, {
      voucherPercent: 0,
      deliveryCents: 0,
    });
    expect(totals.lines.map((line) => line.outOfStock)).toEqual([true, false, true]);
  });

  it("never applies the voucher to an offer line (BASK-7)", () => {
    const totals = priceBasket([each("beans", 2)], shop, { voucherPercent: 50, deliveryCents: 0 });
    expect(totals.voucherCents).toBe(0);
    expect(totals.afterDiscountCents).toBe(200);
  });

  it("rounds the voucher to the nearest cent", () => {
    // 10% of 125 = 12.5 -> 13
    const dearer = new Map<string, Product>([["x", product({ sku: "x", priceCents: 125 })]]);
    const roundedUp = priceBasket([each("x", 1)], dearer, { voucherPercent: 10, deliveryCents: 0 });
    expect(roundedUp.voucherCents).toBe(13);
    // 10% of 124 = 12.4 -> 12
    const cheaper = new Map<string, Product>([["x", product({ sku: "x", priceCents: 124 })]]);
    const down = priceBasket([each("x", 1)], cheaper, { voucherPercent: 10, deliveryCents: 0 });
    expect(down.voucherCents).toBe(12);
  });

  it("throws for an unknown sku", () => {
    expect(() =>
      priceBasket([each("nope", 1)], shop, { voucherPercent: 0, deliveryCents: 0 }),
    ).toThrow("No product with sku nope.");
  });
});

describe("meetsMinimum (BASK-8)", () => {
  it("fails one cent below the minimum", () => {
    expect(meetsMinimum(1999, 2000)).toBe(false);
  });
  it("passes exactly at the minimum", () => {
    expect(meetsMinimum(2000, 2000)).toBe(true);
  });
  it("passes above the minimum", () => {
    expect(meetsMinimum(2001, 2000)).toBe(true);
  });
});

describe("addToLines (BASK-1)", () => {
  it("adds a new each line with the amount as quantity", () => {
    expect(addToLines([], milk, 2)).toEqual([{ sku: "milk", qty: 2, grams: 0, substitutes: true }]);
  });

  it("adds a new kg line with qty 1 and the amount as grams", () => {
    expect(addToLines([], bananas, 250)).toEqual([
      { sku: "banana", qty: 1, grams: 250, substitutes: true },
    ]);
  });

  it("does not change the original array when adding a new line", () => {
    const lines: Line[] = [each("milk", 1)];
    const result = addToLines(lines, bananas, 250);
    expect(lines.length).toBe(1);
    expect(result.length).toBe(2);
    expect(result[0]).toBe(lines[0]);
  });

  it("raises the quantity of an existing each line", () => {
    const lines = [each("milk", 2)];
    const result = addToLines(lines, milk, 3);
    expect(result).toEqual([{ sku: "milk", qty: 5, grams: 0, substitutes: true }]);
    expect(result).toBe(lines);
  });

  it("caps the quantity at 20", () => {
    expect(addToLines([each("milk", 19)], milk, 1)[0].qty).toBe(20);
    expect(addToLines([each("milk", 19)], milk, 2)[0].qty).toBe(20);
    expect(addToLines([each("milk", 18)], milk, 1)[0].qty).toBe(19);
  });

  it("raises the grams of an existing kg line", () => {
    const lines = [weighed("banana", 500)];
    const result = addToLines(lines, bananas, 250);
    expect(result).toEqual([{ sku: "banana", qty: 1, grams: 750, substitutes: true }]);
    expect(result).toBe(lines);
  });

  it("finds the matching line among others", () => {
    const lines = [each("milk", 1), each("beans", 1)];
    const result = addToLines(lines, beans, 1);
    expect(result.map((line) => line.qty)).toEqual([1, 2]);
  });
});

describe("removeOne (BASK-3)", () => {
  it("returns the same lines when the product is missing", () => {
    const lines = [each("milk", 1)];
    expect(removeOne(lines, beans)).toBe(lines);
    expect(lines).toEqual([each("milk", 1)]);
  });

  it("lowers quantity from 2 to 1", () => {
    const lines = [each("milk", 2)];
    const result = removeOne(lines, milk);
    expect(result).toEqual([each("milk", 1)]);
    expect(result).toBe(lines);
  });

  it("removes the line at the last unit", () => {
    expect(removeOne([each("milk", 1), each("beans", 1)], milk)).toEqual([each("beans", 1)]);
  });

  it("lowers grams by 250", () => {
    const result = removeOne([weighed("banana", 500)], bananas);
    expect(result).toEqual([weighed("banana", 250)]);
  });

  it("removes a kg line at the last 250 g", () => {
    expect(removeOne([weighed("banana", 250)], bananas)).toEqual([]);
  });

  it("removes a kg line that drops below 0 g", () => {
    expect(removeOne([weighed("banana", 100)], bananas)).toEqual([]);
  });

  it("keeps a kg line with 1 g left", () => {
    expect(removeOne([weighed("banana", 251)], bananas)).toEqual([weighed("banana", 1)]);
  });

  it("does not touch qty of a kg line", () => {
    const result = removeOne([{ sku: "banana", qty: 1, grams: 500, substitutes: true }], bananas);
    expect(result[0].qty).toBe(1);
  });

  it("does not touch grams of an each line", () => {
    const result = removeOne([{ sku: "milk", qty: 2, grams: 0, substitutes: true }], milk);
    expect(result[0].grams).toBe(0);
  });
});

describe("setQuantity", () => {
  it("rejects a fraction", () => {
    expect(() => setQuantity([each("milk", 1)], milk, 1.5)).toThrow(
      "Quantity must be a whole number.",
    );
  });
  it("rejects 0", () => {
    expect(() => setQuantity([each("milk", 1)], milk, 0)).toThrow("Quantity must be from 1 to 20.");
  });
  it("rejects 21", () => {
    expect(() => setQuantity([each("milk", 1)], milk, 21)).toThrow(
      "Quantity must be from 1 to 20.",
    );
  });
  it("throws RangeError", () => {
    expect(() => setQuantity([], milk, 0)).toThrow(RangeError);
    expect(() => setQuantity([], milk, 1.5)).toThrow(RangeError);
  });
  it("accepts 1", () => {
    expect(setQuantity([each("milk", 5)], milk, 1)).toEqual([each("milk", 1)]);
  });
  it("accepts 20", () => {
    expect(setQuantity([each("milk", 5)], milk, 20)).toEqual([each("milk", 20)]);
  });
  it("returns the same lines when the product is missing", () => {
    const lines = [each("milk", 5)];
    expect(setQuantity(lines, beans, 3)).toBe(lines);
    expect(lines).toEqual([each("milk", 5)]);
  });
  it("sets grams as steps of 250 for kg items", () => {
    const result = setQuantity([weighed("banana", 250)], bananas, 3);
    expect(result).toEqual([weighed("banana", 750)]);
  });
  it("mutates and returns the same array", () => {
    const lines = [each("milk", 5)];
    expect(setQuantity(lines, milk, 7)).toBe(lines);
    expect(lines[0].qty).toBe(7);
  });
});
