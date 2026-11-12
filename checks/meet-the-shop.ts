// meet-the-shop: the learner set up the repo, placed one order by hand and ran the finished suite.
// The receipt is signed by the shop, so the check reads what happened in the world, not what was typed.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { browserEnv } from "./lib/browser";
import { verifyReceipt, type Receipt } from "../world/receipt";
import seed from "../world/seed.json";

const receipt = (d: string): Receipt | null => {
  try { return JSON.parse(readFileSync(join(d, "receipt.json"), "utf8")); } catch { return null; }
};
const product = (sku: string) => seed.products.find((p) => p.sku === sku);

export default [
  {
    says: "Bun is 1.4 or newer",
    test: () => { const [a, b] = Bun.version.split(".").map(Number); return a > 1 || (a === 1 && b >= 4); },
    tryNext: "install Bun 1.4 or newer from bun.sh, open a new terminal, and run bun run setup",
  },
  {
    says: "Playwright can find a Chromium",
    test: () => { try { browserEnv(); return true; } catch { return false; } },
    tryNext: "run bun run setup; if the download is blocked, set CHROMIUM_PATH in .env to a Chromium you have",
  },
  {
    says: "receipt.json is in this folder and the shop signed it",
    test: (d) => existsSync(join(d, "receipt.json")) && verifyReceipt(receipt(d)),
    tryNext: "place the order in the shop, click Download receipt on the order page, and save it here as receipt.json without editing it",
  },
  {
    says: "the order has a delivery slot and loose produce sold by weight",
    test: (d) => {
      const r = receipt(d);
      return Boolean(r?.order.slotId && r.order.lines.some((l) => product(l.sku)?.unit === "kg" && l.grams >= 250));
    },
    tryNext: "book a delivery slot and add Bananas, loose with a weight before you check out",
  },
  {
    says: "a chilled out-of-stock item had substitutes switched off and was not substituted",
    test: (d) => {
      const r = receipt(d);
      return Boolean(r?.order.lines.some((l) => product(l.sku)?.chilled && product(l.sku)!.stock <= 0 && !l.substitutes && l.status === "unavailable"));
    },
    tryNext: "add Whole milk 2 L, untick Allow substitutes on its basket line, then place a new order",
  },
  {
    says: "goal.md has the last line of the goal board",
    test: (d) => /Reference suite: \d+ of 16 planted bugs caught/.test(existsSync(join(d, "goal.md")) ? readFileSync(join(d, "goal.md"), "utf8") : ""),
    tryNext: "run bun run board from the repo root and paste its last line into goal.md",
  },
] satisfies Rule[];
