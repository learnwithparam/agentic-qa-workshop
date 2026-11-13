// meet-the-shop: the learner set up the repo, placed one order by hand and ran the finished suite.
// The receipt is signed by the shop,
// so the check reads what happened in the world, not what was typed.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { type Receipt, verifyReceipt } from "../world/receipt";
import seed from "../world/seed.json";
import { browserEnv } from "./lib/browser";

type ReceiptLine = Receipt["order"]["lines"][number];

const LOOSE_PRODUCE_SMALLEST_GRAMS = 250;

function readReceipt(folder: string): Receipt | null {
  try {
    return JSON.parse(readFileSync(join(folder, "receipt.json"), "utf8"));
  } catch {
    return null;
  }
}

const productWithSku = (sku: string) => seed.products.find((product) => product.sku === sku);

function bunIsNewEnough(): boolean {
  const [major, minor] = Bun.version.split(".").map(Number);
  return major > 1 || (major === 1 && minor >= 4);
}

function chromiumIsFound(): boolean {
  try {
    browserEnv();
    return true;
  } catch {
    return false;
  }
}

function receiptIsSigned(folder: string): boolean {
  return existsSync(join(folder, "receipt.json")) && verifyReceipt(readReceipt(folder));
}

function isLooseProduceByWeight(line: ReceiptLine): boolean {
  const product = productWithSku(line.sku);
  return product?.unit === "kg" && line.grams >= LOOSE_PRODUCE_SMALLEST_GRAMS;
}

function hasSlotAndLooseProduce(folder: string): boolean {
  const order = readReceipt(folder)?.order;
  return Boolean(order?.slotId && order.lines.some(isLooseProduceByWeight));
}

function isChilledOutOfStockNotSubstituted(line: ReceiptLine): boolean {
  const product = productWithSku(line.sku);
  if (!product?.chilled) return false;
  return product.stock <= 0 && !line.substitutes && line.status === "unavailable";
}

function hasChilledItemNotSubstituted(folder: string): boolean {
  const order = readReceipt(folder)?.order;
  return Boolean(order?.lines.some(isChilledOutOfStockNotSubstituted));
}

function goalText(folder: string): string {
  const goalFile = join(folder, "goal.md");
  if (!existsSync(goalFile)) return "";
  return readFileSync(goalFile, "utf8");
}

export default [
  {
    says: "Bun is 1.4 or newer",
    test: bunIsNewEnough,
    tryNext: "install Bun 1.4 or newer from bun.sh, open a new terminal, and run bun run setup",
  },
  {
    says: "Playwright can find a Chromium",
    test: chromiumIsFound,
    tryNext:
      "run bun run setup; if the download is blocked, " +
      "set CHROMIUM_PATH in .env to a Chromium you have",
  },
  {
    says: "receipt.json is in this folder and the shop signed it",
    test: receiptIsSigned,
    tryNext:
      "place the order in the shop, click Download receipt on the order page, " +
      "and save it here as receipt.json without editing it",
  },
  {
    says: "the order has a delivery slot and loose produce sold by weight",
    test: hasSlotAndLooseProduce,
    tryNext: "book a delivery slot and add Bananas, loose with a weight before you check out",
  },
  {
    says: "a chilled out-of-stock item had substitutes switched off and was not substituted",
    test: hasChilledItemNotSubstituted,
    tryNext:
      "add Whole milk 2 L, untick Allow substitutes on its basket line, then place a new order",
  },
  {
    says: "goal.md has the last line of the goal board",
    test: (folder) => /Reference suite: \d+ of 16 planted bugs caught/.test(goalText(folder)),
    tryNext: "run bun run board from the repo root and paste its last line into goal.md",
  },
] satisfies Rule[];
