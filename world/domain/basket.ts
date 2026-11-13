// Basket rules: BASK-1 to BASK-9 in world/requirements/basket.md.
import { bugIsOn } from "../bugs";

export type Product = {
  sku: string;
  name: string;
  category: string;
  unit: "each" | "kg";
  priceCents: number;
  allergens: string[];
  stock: number;
  chilled: boolean;
  offer?: "3for2";
};
// A line holds a count for "each" items and grams for "kg" items.
export type Line = { sku: string; qty: number; grams: number; substitutes: boolean };
export type PricedLine = Line & {
  name: string;
  unit: Product["unit"];
  totalCents: number;
  offerCents: number;
  outOfStock: boolean;
};
export type Totals = {
  lines: PricedLine[];
  subtotalCents: number;
  offerCents: number;
  voucherCents: number;
  deliveryCents: number;
  totalCents: number;
  afterDiscountCents: number;
};

export const WEIGHT_STEP_GRAMS = 250;
export const MAX_QTY = 20;

// BASK-4: loose produce costs weight times price per kg, rounded once to the cent.
export function lineTotal(product: Product, line: Line): number {
  if (product.unit !== "kg") {
    return line.qty * product.priceCents;
  }
  if (bugIsOn("weighted-price")) {
    const steps = line.grams / WEIGHT_STEP_GRAMS;
    const stepPrice = Math.round((product.priceCents * WEIGHT_STEP_GRAMS) / 1000);
    return stepPrice * steps;
  }
  return Math.round((line.grams * product.priceCents) / 1000);
}

// BASK-6: 3 for 2. Every third unit of the same product is free.
export function offerDiscount(product: Product, line: Line): number {
  const hasThreeForTwo = product.offer === "3for2" && product.unit === "each";
  if (!hasThreeForTwo) {
    return 0;
  }
  const freeUnits = Math.floor(line.qty / 3);
  return freeUnits * product.priceCents;
}

// Every line comes from a product in the shop, so a missing one is a programming mistake.
function productFor(products: Map<string, Product>, sku: string): Product {
  const product = products.get(sku);
  if (!product) {
    throw new Error(`No product with sku ${sku}.`);
  }
  return product;
}

function priceLine(line: Line, products: Map<string, Product>): PricedLine {
  const product = productFor(products, line.sku);
  return {
    ...line,
    name: product.name,
    unit: product.unit,
    totalCents: lineTotal(product, line),
    offerCents: offerDiscount(product, line),
    outOfStock: product.stock <= 0,
  };
}

function sumOf(numbers: number[]): number {
  let total = 0;
  for (const amount of numbers) {
    total += amount;
  }
  return total;
}

// BASK-7: the voucher never applies to a line with a multi-buy offer.
function voucherBaseCents(
  priced: PricedLine[],
  products: Map<string, Product>,
  subtotalCents: number,
  offerCents: number,
): number {
  if (bugIsOn("promo-stacking")) {
    return subtotalCents - offerCents;
  }
  const linesWithoutOffer = priced.filter((line) => !productFor(products, line.sku).offer);
  return sumOf(linesWithoutOffer.map((line) => line.totalCents));
}

export function priceBasket(
  lines: Line[],
  products: Map<string, Product>,
  opts: { voucherPercent: number; deliveryCents: number },
): Totals {
  const priced = lines.map((line) => priceLine(line, products));
  const subtotalCents = sumOf(priced.map((line) => line.totalCents));
  const offerCents = sumOf(priced.map((line) => line.offerCents));
  const voucherBase = voucherBaseCents(priced, products, subtotalCents, offerCents);
  const voucherCents = Math.round((voucherBase * opts.voucherPercent) / 100);
  const afterDiscountCents = subtotalCents - offerCents - voucherCents;
  return {
    lines: priced,
    subtotalCents,
    offerCents,
    voucherCents,
    deliveryCents: opts.deliveryCents,
    afterDiscountCents,
    totalCents: afterDiscountCents + opts.deliveryCents,
  };
}

// BASK-8: checkout needs at least the minimum after discounts.
export function meetsMinimum(
  afterDiscountCents: number,
  peakCents: number,
  minimumCents: number,
): boolean {
  if (bugIsOn("min-order")) {
    return peakCents >= minimumCents;
  }
  return afterDiscountCents >= minimumCents;
}

function lineFor(lines: Line[], product: Product): Line | undefined {
  return lines.find((line) => line.sku === product.sku);
}

// BASK-1: adding an item that is already in the basket raises its quantity.
export function addToLines(lines: Line[], product: Product, amount: number): Line[] {
  const existing = lineFor(lines, product);
  const soldByWeight = product.unit === "kg";
  if (existing) {
    if (soldByWeight) {
      existing.grams += amount;
    } else {
      existing.qty = Math.min(MAX_QTY, existing.qty + amount);
    }
    return lines;
  }
  const newLine: Line = {
    sku: product.sku,
    qty: soldByWeight ? 1 : amount,
    grams: soldByWeight ? amount : 0,
    substitutes: true,
  };
  return [...lines, newLine];
}

// BASK-3: removing the last unit removes the line.
export function removeOne(lines: Line[], product: Product): Line[] {
  const line = lineFor(lines, product);
  if (!line) {
    return lines;
  }
  let empty: boolean;
  if (product.unit === "kg") {
    line.grams -= WEIGHT_STEP_GRAMS;
    empty = line.grams <= 0;
  } else {
    line.qty -= 1;
    empty = line.qty <= 0;
  }
  if (!empty) {
    return lines;
  }
  if (bugIsOn("ghost-line")) {
    line.qty = 0;
    line.grams = 0;
    return lines;
  }
  return lines.filter((otherLine) => otherLine !== line);
}

// The quantity box. No written rule covers a negative number.
export function setQuantity(lines: Line[], product: Product, qty: number): Line[] {
  if (!Number.isInteger(qty)) {
    throw new RangeError("Quantity must be a whole number.");
  }
  const outOfRange = qty < 1 || qty > MAX_QTY;
  if (!bugIsOn("negative-qty") && outOfRange) {
    throw new RangeError(`Quantity must be from 1 to ${MAX_QTY}.`);
  }
  const line = lineFor(lines, product);
  if (!line) {
    return lines;
  }
  if (product.unit === "kg") {
    line.grams = qty * WEIGHT_STEP_GRAMS;
  } else {
    line.qty = qty;
  }
  return lines;
}
