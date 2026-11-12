// Substitutions at packing: SUB-1 to SUB-7 in world/requirements/substitutions.md.
import { on } from "../bugs";
import type { Line, Product } from "./basket";

export const PRICE_TOLERANCE = 0.15;

// SUB-5: a substitute costs at most 15% more than the item it replaces.
export function withinPrice(original: Product, candidate: Product): boolean {
  return candidate.priceCents <= Math.floor(original.priceCents * (1 + PRICE_TOLERANCE));
}

export function safeFor(candidate: Product, allergens: string[]): boolean {
  return !candidate.allergens.some((a) => allergens.includes(a));
}

// SUB-3, SUB-4, SUB-5, SUB-6: same category, no declared allergen, within price, in stock. Closest price wins.
export function pickSubstitute(original: Product, products: Product[], allergens: string[]): Product | null {
  const ok = products.filter(
    (p) =>
      p.sku !== original.sku &&
      p.category === original.category &&
      p.stock > 0 &&
      withinPrice(original, p) &&
      (on("sub-allergen") || safeFor(p, allergens)),
  );
  ok.sort((a, b) => Math.abs(a.priceCents - original.priceCents) - Math.abs(b.priceCents - original.priceCents) || a.sku.localeCompare(b.sku));
  return ok[0] ?? null;
}

export type Packed = { sku: string; status: "packed" | "substituted" | "unavailable"; substituteSku?: string; substituteName?: string };

// SUB-2: "No substitutes" is always respected, chilled items included.
export function packLine(line: Line, product: Product, products: Product[], allergens: string[]): Packed {
  if (product.stock > 0) return { sku: line.sku, status: "packed" };
  const optedOut = !line.substitutes && !(on("sub-optout-chilled") && product.chilled);
  if (optedOut) return { sku: line.sku, status: "unavailable" };
  const sub = pickSubstitute(product, products, allergens);
  return sub ? { sku: line.sku, status: "substituted", substituteSku: sub.sku, substituteName: sub.name } : { sku: line.sku, status: "unavailable" };
}
