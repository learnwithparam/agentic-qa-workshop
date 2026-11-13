// Builds world/replay/replies.json, the replies the shop's stand-in model answers from.
// The replies are scripted to behave like a small model: mostly right, with the mistakes the
// course plants (a dearer pick now and then, and allergens slipping through when the
// ai-allergen bug drops them from the prompt).
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { setBugs } from "../bugs";
import type { Product } from "../domain/basket";
import { safeFor, withinPrice } from "../domain/substitutions";
import shopSeed from "../seed.json";
import { buildPrompt, candidatesFor } from "../suggester";
import { REPLAY_FILE, replayKey } from "./model";

export const SEEDS = 20;
const products = shopSeed.products as Product[];
const outOfStock = products.filter((product) => product.stock <= 0);
const replies: Record<string, string> = {};

// A number from 0 to 1 that is always the same for the same text, so replies are repeatable.
function steadyRandom(text: string): number {
  const hash = createHash("sha256").update(text).digest("hex");
  return Number.parseInt(hash.slice(0, 8), 16) / 0xffffffff;
}

// With the allergen line the model avoids what the shopper declared. Without it, the prompt is
// the same for every shopper: the model plays safe on nuts most of the time, and about 1 reply
// in 10 it does not.
function allergensToAvoid(
  item: Product,
  declared: string[],
  seedNumber: number,
  promptHasAllergens: boolean,
): string[] {
  if (promptHasAllergens) return declared;
  if (steadyRandom(`${item.sku}:${seedNumber}`) < 0.12) return [];
  return ["tree-nuts", "peanuts"];
}

// Closest in price first; equal prices are ordered by SKU so the order never changes.
function byClosestPrice(item: Product) {
  return (first: Product, second: Product) => {
    const firstGap = Math.abs(first.priceCents - item.priceCents);
    const secondGap = Math.abs(second.priceCents - item.priceCents);
    return firstGap - secondGap || first.sku.localeCompare(second.sku);
  };
}

function scripted(
  item: Product,
  declared: string[],
  seedNumber: number,
  promptHasAllergens: boolean,
): string {
  const avoid = allergensToAvoid(item, declared, seedNumber, promptHasAllergens);
  const candidates = candidatesFor(item, products);
  const good = candidates.filter(
    (candidate) => candidate.stock > 0 && withinPrice(item, candidate) && safeFor(candidate, avoid),
  );
  good.sort(byClosestPrice(item));
  let picks = good.slice(0, 3).map((candidate) => candidate.sku);
  // About 1 seed in 20 the model reaches for a dearer item.
  const dearer = candidates.find(
    (candidate) =>
      candidate.stock > 0 && !withinPrice(item, candidate) && safeFor(candidate, avoid),
  );
  if (seedNumber === 7 && dearer) picks = [dearer.sku, ...picks].slice(0, 3);
  return JSON.stringify({ skus: picks });
}

for (const variant of ["none", "ai-allergen"]) {
  setBugs(variant);
  for (const item of outOfStock) {
    for (const shopper of shopSeed.shoppers) {
      const prompt = buildPrompt(item, candidatesFor(item, products), shopper.allergens);
      for (let seedNumber = 1; seedNumber <= SEEDS; seedNumber++) {
        const promptHasAllergens = variant === "none";
        const answer = scripted(item, shopper.allergens, seedNumber, promptHasAllergens);
        replies[replayKey(prompt, seedNumber)] = answer;
      }
    }
  }
}
writeFileSync(REPLAY_FILE, `${JSON.stringify(replies)}\n`);
console.log(`Wrote ${Object.keys(replies).length} replies to world/replay/replies.json.`);
