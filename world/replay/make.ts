// Builds world/replay/replies.json, the recorded replies replay mode answers from.
// With a live provider set (LLM_PROVIDER=anthropic and a key), it records real replies.
// With no key it writes scripted replies that behave like a small model: mostly right, with the
// mistakes the course plants. The checks never depend on which way the file was made.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import seed from "../seed.json";
import { setBugs } from "../bugs";
import { buildPrompt, candidatesFor } from "../suggester";
import { complete, REPLAY_FILE, replayKey } from "../../config/llm";
import { PING } from "../../config/ping";
import { provider } from "../../config/models";
import { safeFor, withinPrice } from "../domain/substitutions";
import type { Product } from "../domain/basket";

export const SEEDS = 20;
const products = seed.products as Product[];
const outOfStock = products.filter((p) => p.stock <= 0);
const out: Record<string, string> = {};

const rand = (s: string) => parseInt(createHash("sha256").update(s).digest("hex").slice(0, 8), 16) / 0xffffffff;

function scripted(item: Product, declared: string[], seedN: number, promptHasAllergens: boolean): string {
  // With the allergen line the model avoids what the shopper declared. Without it, the prompt is the same
  // for every shopper: the model plays safe on nuts most of the time, and about 1 reply in 10 it does not.
  const avoid = promptHasAllergens ? declared : rand(`${item.sku}:${seedN}`) < 0.12 ? [] : ["tree-nuts", "peanuts"];
  const cands = candidatesFor(item, products);
  const good = cands
    .filter((c) => c.stock > 0 && withinPrice(item, c) && safeFor(c, avoid))
    .sort((a, b) => Math.abs(a.priceCents - item.priceCents) - Math.abs(b.priceCents - item.priceCents) || a.sku.localeCompare(b.sku));
  let picks = good.slice(0, 3).map((c) => c.sku);
  // About 1 seed in 20 the model reaches for a dearer item.
  const dear = cands.find((c) => c.stock > 0 && !withinPrice(item, c) && safeFor(c, avoid));
  if (seedN === 7 && dear) picks = [dear.sku, ...picks].slice(0, 3);
  return JSON.stringify({ skus: picks });
}

const live = provider() !== "replay";
for (const variant of ["none", "ai-allergen"]) {
  setBugs(variant);
  for (const item of outOfStock) {
    for (const shopper of seed.shoppers) {
      const prompt = buildPrompt(item, candidatesFor(item, products), shopper.allergens);
      for (let s = 1; s <= SEEDS; s++) {
        out[replayKey("fast", prompt, s)] = live
          ? (await complete("fast", prompt, { seed: s })).text
          : scripted(item, shopper.allergens, s, variant === "none");
      }
    }
  }
}
for (const role of ["fast", "smart", "judge"] as const) out[replayKey(role, PING, 0)] = live ? (await complete(role, PING)).text : "ready";
writeFileSync(REPLAY_FILE, JSON.stringify(out) + "\n");
console.log(`Wrote ${Object.keys(out).length} replies to world/replay/replies.json (${live ? "recorded live" : "scripted, no key"}).`);
