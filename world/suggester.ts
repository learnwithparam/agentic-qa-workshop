// The AI feature: when an item is out of stock, a model suggests up to three replacements.
// It answers from the shop's stand-in model (world/replay/model.ts), so the same seed gives the same answer.
import { on } from "./bugs";
import type { Product } from "./domain/basket";
import { reply } from "./replay/model";

export const MAX_SUGGESTIONS = 3;

// The candidates the model sees: everything in the same category, in stock or not. The model must choose well.
export function candidatesFor(item: Product, all: Product[]): Product[] {
  return all.filter((p) => p.sku !== item.sku && p.category === item.category);
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export function buildPrompt(item: Product, candidates: Product[], allergens: string[]): string {
  const lines = [
    "You suggest replacements for an out-of-stock grocery item.",
    `Item: ${item.sku} | ${item.name} | ${item.category} | ${money(item.priceCents)}`,
  ];
  // The planted bug: the allergen line is dropped from the prompt.
  if (!on("ai-allergen"))
    lines.push(`Shopper allergens: ${allergens.length ? allergens.join(", ") : "none declared"}`);
  lines.push(
    "Rules: same category, in stock, at most 15% dearer, never an allergen the shopper declared.",
    "Candidates (sku | name | category | price | allergens | stock):",
    ...candidates.map(
      (c) =>
        `${c.sku} | ${c.name} | ${c.category} | ${money(c.priceCents)} | ${c.allergens.join(" ") || "none"} | ${c.stock}`,
    ),
    `Reply with JSON only: {"skus": [up to ${MAX_SUGGESTIONS} skus, best first]}`,
  );
  return lines.join("\n");
}

export function parseReply(text: string): string[] {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return [];
  try {
    const j = JSON.parse(m[0]);
    return Array.isArray(j.skus) ? j.skus.filter((s: unknown) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export async function suggest(item: Product, all: Product[], allergens: string[], seed: number) {
  const prompt = buildPrompt(item, candidatesFor(item, all), allergens);
  const text = reply(prompt, seed);
  const bySku = new Map(all.map((p) => [p.sku, p]));
  return parseReply(text)
    .map((s) => bySku.get(s))
    .filter((p): p is Product => Boolean(p))
    .slice(0, MAX_SUGGESTIONS);
}
