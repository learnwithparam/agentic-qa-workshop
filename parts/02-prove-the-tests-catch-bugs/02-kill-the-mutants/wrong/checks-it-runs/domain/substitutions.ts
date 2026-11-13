// Substitutions at packing: SUB-1 to SUB-7 in world/requirements/substitutions.md.
// This is the fixed build of world/domain/substitutions.ts, with the planted bugs taken out.
import type { Line, Product } from "./basket";

export const PRICE_TOLERANCE = 0.15;

// SUB-5: a substitute costs at most 15% more than the item it replaces.
export function withinPrice(original: Product, candidate: Product): boolean {
  return candidate.priceCents <= Math.floor(original.priceCents * (1 + PRICE_TOLERANCE));
}

export function safeFor(candidate: Product, allergens: string[]): boolean {
  return !candidate.allergens.some((allergen) => allergens.includes(allergen));
}

// SUB-3, SUB-4, SUB-5, SUB-6: same category, no declared allergen, within price, in stock.
// The closest price wins.
function canReplace(original: Product, candidate: Product, allergens: string[]): boolean {
  return (
    candidate.sku !== original.sku &&
    candidate.category === original.category &&
    candidate.stock > 0 &&
    withinPrice(original, candidate) &&
    safeFor(candidate, allergens)
  );
}

export function pickSubstitute(
  original: Product,
  products: Product[],
  allergens: string[],
): Product | null {
  const suitable = products.filter((candidate) => canReplace(original, candidate, allergens));
  const priceGap = (candidate: Product) => Math.abs(candidate.priceCents - original.priceCents);
  // Equal price gaps are ordered by sku, so the choice is always the same.
  suitable.sort(
    (first, second) => priceGap(first) - priceGap(second) || first.sku.localeCompare(second.sku),
  );
  return suitable[0] ?? null;
}

export type Packed = {
  sku: string;
  status: "packed" | "substituted" | "unavailable";
  substituteSku?: string;
  substituteName?: string;
};

// SUB-2: "No substitutes" is always respected, chilled items included.
export function packLine(
  line: Line,
  product: Product,
  products: Product[],
  allergens: string[],
): Packed {
  if (product.stock > 0) {
    return { sku: line.sku, status: "packed" };
  }
  if (!line.substitutes) {
    return { sku: line.sku, status: "unavailable" };
  }
  const substitute = pickSubstitute(product, products, allergens);
  if (!substitute) {
    return { sku: line.sku, status: "unavailable" };
  }
  return {
    sku: line.sku,
    status: "substituted",
    substituteSku: substitute.sku,
    substituteName: substitute.name,
  };
}
