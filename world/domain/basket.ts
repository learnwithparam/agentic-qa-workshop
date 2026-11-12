// Basket rules: BASK-1 to BASK-9 in world/requirements/basket.md.
import { on } from "../bugs";

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
export function lineTotal(p: Product, line: Line): number {
  if (p.unit === "kg") {
    if (on("weighted-price")) {
      const steps = line.grams / WEIGHT_STEP_GRAMS;
      return Math.round((p.priceCents * WEIGHT_STEP_GRAMS) / 1000) * steps;
    }
    return Math.round((line.grams * p.priceCents) / 1000);
  }
  return line.qty * p.priceCents;
}

// BASK-6: 3 for 2. Every third unit of the same product is free.
export function offerDiscount(p: Product, line: Line): number {
  return p.offer === "3for2" && p.unit === "each" ? Math.floor(line.qty / 3) * p.priceCents : 0;
}

export function priceBasket(
  lines: Line[],
  products: Map<string, Product>,
  opts: { voucherPercent: number; deliveryCents: number },
): Totals {
  const priced: PricedLine[] = lines.map((l) => {
    const p = products.get(l.sku)!;
    return {
      ...l,
      name: p.name,
      unit: p.unit,
      totalCents: lineTotal(p, l),
      offerCents: offerDiscount(p, l),
      outOfStock: p.stock <= 0,
    };
  });
  const subtotalCents = priced.reduce((a, l) => a + l.totalCents, 0);
  const offerCents = priced.reduce((a, l) => a + l.offerCents, 0);
  // BASK-7: the voucher never applies to a line with a multi-buy offer.
  const voucherBase = on("promo-stacking")
    ? subtotalCents - offerCents
    : priced.filter((l) => !products.get(l.sku)!.offer).reduce((a, l) => a + l.totalCents, 0);
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
  return on("min-order") ? peakCents >= minimumCents : afterDiscountCents >= minimumCents;
}

// BASK-1: adding an item that is already in the basket raises its quantity.
export function addToLines(lines: Line[], p: Product, amount: number): Line[] {
  const existing = lines.find((l) => l.sku === p.sku);
  if (existing) {
    if (p.unit === "kg") existing.grams += amount;
    else existing.qty = Math.min(MAX_QTY, existing.qty + amount);
    return lines;
  }
  return [
    ...lines,
    {
      sku: p.sku,
      qty: p.unit === "kg" ? 1 : amount,
      grams: p.unit === "kg" ? amount : 0,
      substitutes: true,
    },
  ];
}

// BASK-3: removing the last unit removes the line.
export function removeOne(lines: Line[], p: Product): Line[] {
  const line = lines.find((l) => l.sku === p.sku);
  if (!line) return lines;
  if (p.unit === "kg") line.grams -= WEIGHT_STEP_GRAMS;
  else line.qty -= 1;
  const empty = p.unit === "kg" ? line.grams <= 0 : line.qty <= 0;
  if (empty && on("ghost-line")) {
    line.qty = 0;
    line.grams = 0;
    return lines;
  }
  return empty ? lines.filter((l) => l !== line) : lines;
}

// The quantity box. No written rule covers a negative number.
export function setQuantity(lines: Line[], p: Product, qty: number): Line[] {
  if (!Number.isInteger(qty)) throw new RangeError("Quantity must be a whole number.");
  if (!on("negative-qty") && (qty < 1 || qty > MAX_QTY))
    throw new RangeError(`Quantity must be from 1 to ${MAX_QTY}.`);
  const line = lines.find((l) => l.sku === p.sku);
  if (!line) return lines;
  if (p.unit === "kg") line.grams = qty * WEIGHT_STEP_GRAMS;
  else line.qty = qty;
  return lines;
}
