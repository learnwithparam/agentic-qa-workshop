// Builds world/replay/replies.json, the replies the shop's stand-in model answers from.
// The replies are scripted to behave like a small model: mostly right, with the mistakes the course plants
// (a dearer pick now and then, and allergens slipping through when the ai-allergen bug drops them from the prompt).
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { setBugs } from "../bugs";
import type { Product } from "../domain/basket";
import { safeFor, withinPrice } from "../domain/substitutions";
import seed from "../seed.json";
import { buildPrompt, candidatesFor } from "../suggester";
import { REPLAY_FILE, replayKey } from "./model";

export const SEEDS = 20;
const products = seed.products as Product[];
const outOfStock = products.filter((p) => p.stock <= 0);
const out: Record<string, string> = {};

const rand = (s: string) =>
  parseInt(createHash("sha256").update(s).digest("hex").slice(0, 8), 16) / 0xffffffff;

function scripted(
  item: Product,
  declared: string[],
  seedN: number,
  promptHasAllergens: boolean,
): string {
  // With the allergen line the model avoids what the shopper declared. Without it, the prompt is the same
  // for every shopper: the model plays safe on nuts most of the time, and about 1 reply in 10 it does not.
  const avoid = promptHasAllergens
    ? declared
    : rand(`${item.sku}:${seedN}`) < 0.12
      ? []
      : ["tree-nuts", "peanuts"];
  const cands = candidatesFor(item, products);
  const good = cands
    .filter((c) => c.stock > 0 && withinPrice(item, c) && safeFor(c, avoid))
    .sort(
      (a, b) =>
        Math.abs(a.priceCents - item.priceCents) - Math.abs(b.priceCents - item.priceCents) ||
        a.sku.localeCompare(b.sku),
    );
  let picks = good.slice(0, 3).map((c) => c.sku);
  // About 1 seed in 20 the model reaches for a dearer item.
  const dear = cands.find((c) => c.stock > 0 && !withinPrice(item, c) && safeFor(c, avoid));
  if (seedN === 7 && dear) picks = [dear.sku, ...picks].slice(0, 3);
  return JSON.stringify({ skus: picks });
}

for (const variant of ["none", "ai-allergen"]) {
  setBugs(variant);
  for (const item of outOfStock) {
    for (const shopper of seed.shoppers) {
      const prompt = buildPrompt(item, candidatesFor(item, products), shopper.allergens);
      for (let s = 1; s <= SEEDS; s++) {
        out[replayKey(prompt, s)] = scripted(item, shopper.allergens, s, variant === "none");
      }
    }
  }
}
writeFileSync(REPLAY_FILE, JSON.stringify(out) + "\n");
console.log(`Wrote ${Object.keys(out).length} replies to world/replay/replies.json.`);
