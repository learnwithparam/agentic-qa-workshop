// test-the-substitution-suggester: the suggester gives a new answer per seed, so it is judged by
// properties over many seeds, with a pass rate, and allergens as a hard fail.
// The check reads the learner's notes against the real answers, runs the suite through a
// recording door, and bends the answers on their way back to see if the suite notices.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkNotes,
  failureKindsAreShown,
  readNotes,
} from "../parts/04-test-beyond-the-ui/helpers/notes";
import { openDoor, type Rewrite } from "../parts/04-test-beyond-the-ui/helpers/traffic";
import type { Rule } from "../scripts/verify";
import shopSeed from "../world/seed.json";
import { readText } from "./lib/markdown";
import { once } from "./lib/memo";
import { specFiles } from "./lib/static";
import { runSuite } from "./lib/suite";
import { withShop } from "./lib/world";

const FEWEST_SEEDS = 20;
const FEWEST_ROWS_READ = 20;

type Thresholds = { seeds?: number; minPassRate?: number; hardFail?: string[] };
type Product = (typeof shopSeed.products)[number];
type Answer = { allergens: string[]; suggestions: Partial<Product>[] };

const aiTests = (folder: string) => join(folder, "tests", "ai");
const thresholdsPath = (folder: string) => join(folder, "qa", "ai-thresholds.json");

function readThresholds(folder: string): Thresholds {
  if (!existsSync(thresholdsPath(folder))) return {};
  return JSON.parse(readFileSync(thresholdsPath(folder), "utf8"));
}

function thresholdsAreSound(folder: string): boolean {
  const thresholds = readThresholds(folder);
  const seeds = thresholds.seeds ?? 0;
  const rate = thresholds.minPassRate ?? 0;
  const hardFail = (thresholds.hardFail ?? []).map((name) => name.toLowerCase());
  const rateIsSensible = rate >= 0.9 && rate < 1;
  return (
    seeds >= FEWEST_SEEDS && rateIsSensible && hardFail.some((name) => name.includes("allergen"))
  );
}

function suiteReadsTheThresholds(folder: string): boolean {
  const files = specFiles(aiTests(folder));
  const readsThem = (file: string) => readFileSync(file, "utf8").includes("ai-thresholds.json");
  return files.length > 0 && files.some(readsThem);
}

type Bent = { ran: boolean; green: boolean; seeds: number };

// Runs the suite on a shop through the door. The rewrite, if any, bends the suggester's answers.
function runBent(folder: string, bugs: string, rewrite?: Rewrite): Promise<Bent> {
  return withShop({ bugs }, async (shop) => {
    const door = openDoor(shop, { rewritePath: "/api/suggest", rewrite });
    try {
      const suite = await runSuite(aiTests(folder), door.url);
      const asked = door.exchanges.filter((call) => call.path === "/api/suggest");
      const seeds = new Set(asked.map((call) => call.query.get("seed")));
      return { ran: suite.ran, green: suite.ran && suite.failed === 0, seeds: seeds.size };
    } finally {
      door.close();
    }
  });
}

// Red means the tests ran and at least one failed. A suite that never ran is not red.
const wentRed = (run: Bent) => run.ran && !run.green;

const onFixedBuild = (folder: string) =>
  once("suggester-fixed", folder, () => runBent(folder, "none"));

const withAllergenBug = (folder: string) =>
  once("suggester-bug", folder, () => runBent(folder, "ai-allergen"));

// A real product from the same category that holds one of the shopper's allergens.
function productWithAllergen(missingSku: string, allergens: string[]): Product | undefined {
  const missing = shopSeed.products.find((product) => product.sku === missingSku);
  return shopSeed.products.find(
    (product) =>
      product.category === missing?.category &&
      product.stock > 0 &&
      product.allergens.some((allergen) => allergens.includes(allergen)),
  );
}

// Slips one allergen into one answer out of all the answers the suite asks for.
function oneAllergenInAll(): Rewrite {
  let slipped = false;
  return (answer, query) => {
    const reply = answer as Answer;
    const unsafe = productWithAllergen(query.get("sku") ?? "", reply.allergens);
    if (slipped || !unsafe || reply.suggestions.length === 0) return reply;
    slipped = true;
    return { ...reply, suggestions: [unsafe, ...reply.suggestions.slice(1)] };
  };
}

// The same suggestions in the opposite order: a different answer that is just as good.
const reversedOrder: Rewrite = (answer) => {
  const reply = answer as Answer;
  return { ...reply, suggestions: [...reply.suggestions].reverse() };
};

const withOneAllergen = (folder: string) =>
  once("suggester-one-allergen", folder, () => runBent(folder, "none", oneAllergenInAll()));

const withReversedOrder = (folder: string) =>
  once("suggester-reversed", folder, () => runBent(folder, "none", reversedOrder));

export default [
  {
    says: "qa/ai-notes.md lists at least 20 suggester answers you read",
    test: (folder) => readNotes(folder).rows.length >= FEWEST_ROWS_READ,
    tryNext: "ask Claude Code to fill the notes table: one row per answer, 20 rows",
  },
  {
    says: "every pass or fail in the notes matches what the suggester really answers",
    test: checkNotes,
    tryNext: "read the Wrong rows above; ask Claude Code to call /api/suggest again for each one",
  },
  {
    says: "the notes name at least 2 failure kinds, each shown by a failing row",
    test: (folder) => failureKindsAreShown(readText(join(folder, "qa", "ai-notes.md")), folder),
    tryNext: "list each kind under ## Failure kinds with its rule, such as SUB-4 or SUB-5",
  },
  {
    says: "qa/ai-thresholds.json: 20+ seeds, a pass rate from 0.9 to below 1, allergen in hardFail",
    test: thresholdsAreSound,
    tryNext:
      "ask Claude Code to write qa/ai-thresholds.json with seeds, minPassRate and hardFail, " +
      'for example {"seeds": 20, "minPassRate": 0.95, "hardFail": ["allergen"]}',
  },
  {
    says: "the suite in tests/ai/ reads its limits from qa/ai-thresholds.json",
    test: suiteReadsTheThresholds,
    tryNext:
      "ask Claude Code to load the thresholds file in the test instead of typing the numbers",
  },
  {
    says: "the suite passes on the fixed build",
    test: async (folder) => (await onFixedBuild(folder)).green,
    tryNext:
      "run bunx playwright test tests/ai; a pass rate that is too strict fails on good answers",
  },
  {
    says: "the suite asks the suggester for at least 20 different seeds",
    test: async (folder) => (await onFixedBuild(folder)).seeds >= FEWEST_SEEDS,
    tryNext: "loop over seeds 1 to 20 for each out-of-stock item, not one seed",
  },
  {
    says: "the suite goes red when the suggester forgets the shopper's allergens (ai-allergen)",
    test: async (folder) => wentRed(await withAllergenBug(folder)),
    tryNext: "check every suggestion's allergens against the shopper's declared allergens",
  },
  {
    says: "one allergen in all the answers turns the suite red: allergens are a hard fail",
    test: async (folder) => wentRed(await withOneAllergen(folder)),
    tryNext: "count allergen hits apart from the pass rate, and expect exactly zero",
  },
  {
    says: "a different but valid answer keeps the suite green: it checks rules, not exact answers",
    test: async (folder) => (await withReversedOrder(folder)).green,
    tryNext: "do not compare with saved answers; check category, stock, price and allergens",
  },
] satisfies Rule[];
