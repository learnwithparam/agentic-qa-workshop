// The AI feature: when an item is out of stock, a model suggests up to three replacements.
// It answers from the shop's stand-in model (world/replay/model.ts),
// so the same seed gives the same answer.
import { bugIsOn } from "./bugs";
import type { Product } from "./domain/basket";
import { reply } from "./replay/model";

export const MAX_SUGGESTIONS = 3;

// The candidates the model sees: everything in the same category, in stock or not.
// The model must choose well.
export function candidatesFor(item: Product, all: Product[]): Product[] {
  return all.filter(
    (candidate) => candidate.sku !== item.sku && candidate.category === item.category,
  );
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function candidateLine(candidate: Product): string {
  const allergens = candidate.allergens.join(" ") || "none";
  const price = money(candidate.priceCents);
  const start = `${candidate.sku} | ${candidate.name} | ${candidate.category}`;
  return `${start} | ${price} | ${allergens} | ${candidate.stock}`;
}

function allergenLine(allergens: string[]): string {
  if (allergens.length === 0) {
    return "Shopper allergens: none declared";
  }
  return `Shopper allergens: ${allergens.join(", ")}`;
}

export function buildPrompt(item: Product, candidates: Product[], allergens: string[]): string {
  const price = money(item.priceCents);
  const lines = [
    "You suggest replacements for an out-of-stock grocery item.",
    `Item: ${item.sku} | ${item.name} | ${item.category} | ${price}`,
  ];
  // The planted bug: the allergen line is dropped from the prompt.
  if (!bugIsOn("ai-allergen")) {
    lines.push(allergenLine(allergens));
  }
  lines.push(
    "Rules: same category, in stock, at most 15% dearer, never an allergen the shopper declared.",
    "Candidates (sku | name | category | price | allergens | stock):",
    ...candidates.map(candidateLine),
    `Reply with JSON only: {"skus": [up to ${MAX_SUGGESTIONS} skus, best first]}`,
  );
  return lines.join("\n");
}

export function parseReply(text: string): string[] {
  const jsonPart = text.match(/\{[\s\S]*\}/);
  if (!jsonPart) {
    return [];
  }
  try {
    const answer = JSON.parse(jsonPart[0]);
    if (!Array.isArray(answer.skus)) {
      return [];
    }
    return answer.skus.filter((sku: unknown) => typeof sku === "string");
  } catch {
    return [];
  }
}

export async function suggest(item: Product, all: Product[], allergens: string[], seed: number) {
  const prompt = buildPrompt(item, candidatesFor(item, all), allergens);
  const text = reply(prompt, seed);
  const bySku = new Map(all.map((product) => [product.sku, product]));
  const skus = parseReply(text);
  const found = skus.map((sku) => bySku.get(sku));
  const known = found.filter((product): product is Product => Boolean(product));
  return known.slice(0, MAX_SUGGESTIONS);
}
