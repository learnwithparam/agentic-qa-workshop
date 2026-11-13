// catch-the-seeded-bugs: run the learner's suite once per planted requirement bug.
// A bug is caught when the suite goes red with it on. The fixed build must stay green,
// or a red run proves nothing. The learner needs at least 7 of the 8 bugs caught.
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { BUGS, type Bug } from "../world/bugs";
import { bugKillMatrix, type Matrix, printMatrix } from "./lib/matrix";
import { once } from "./lib/memo";

const REQUIREMENT_BUGS = BUGS.filter((bug) => bug.group === "requirement");
const REQUIREMENT_BUG_IDS = REQUIREMENT_BUGS.map((bug) => bug.id);
const FEWEST_CAUGHT = 7;

// What to try for each bug, in the shopper's words. Printed for every missed bug.
const HINTS: Record<string, string> = {
  "slot-cutoff": "set the store clock to 22:00 the evening before and expect the next date Closed",
  "slot-capacity":
    "find the full slot (20 of 20 booked) and expect it to show Full and be disabled",
  "weighted-price": "add 750 g of bananas at $1.39 per kg and expect the line total $1.04",
  "promo-stacking":
    "use SAVE10 with a 3 for 2 line in the basket and expect the exact voucher amount",
  "min-order": "drop the basket below $25.00 after it was above, and expect Checkout disabled",
  "ghost-line": "remove the last unit of a line and expect the line to be gone",
  "sub-allergen":
    "order Oat granola (out of stock) as Ana, who declared tree nuts; expect a nut-free substitute",
  "sub-optout-chilled":
    "switch off Allow substitutes on Whole milk 2 L, check out, and expect Not available",
};

const matrixFor = (folder: string) =>
  once("catch-the-seeded-bugs", folder, () =>
    bugKillMatrix(join(folder, "tests"), REQUIREMENT_BUG_IDS),
  );

function printMissedBug(bug: Bug) {
  console.log(`        missed ${bug.id} (${bug.breaks}): ${bug.what}`);
  console.log(`        try: ${HINTS[bug.id]}`);
}

// The grid is printed once, the first time a rule reads it, so the learner sees every bug.
let printedFor = "";

function printOnce(folder: string, matrix: Matrix) {
  if (printedFor === folder) return;
  printedFor = folder;
  printMatrix(matrix, (line) => console.log(`      ${line}`));
  const missedIds = matrix.rows.filter((row) => !row.caught).map((row) => row.bug);
  const missedBugs = REQUIREMENT_BUGS.filter((bug) => missedIds.includes(bug.id));
  for (const bug of missedBugs) printMissedBug(bug);
}

async function passesOnTheFixedBuild(folder: string): Promise<boolean> {
  const matrix = await matrixFor(folder);
  return matrix.baseline.ran && matrix.baseline.failed === 0;
}

async function catchesEnoughBugs(folder: string): Promise<boolean> {
  const matrix = await matrixFor(folder);
  printOnce(folder, matrix);
  const greenFirst = await passesOnTheFixedBuild(folder);
  return greenFirst && matrix.caught >= FEWEST_CAUGHT;
}

export default [
  {
    says: "the suite passes on the fixed build (BUGS=none)",
    test: passesOnTheFixedBuild,
    tryNext:
      "run bunx playwright test in this folder with bun run shop running, and fix each red test; " +
      "a test that is always red catches every bug and proves nothing",
  },
  {
    says: `the suite goes red on at least ${FEWEST_CAUGHT} of the 8 requirement bugs`,
    test: catchesEnoughBugs,
    tryNext:
      "read the missed lines above; each names the rule the suite never checks. " +
      "Ask Claude Code to plan and write a test for that rule",
  },
] satisfies Rule[];
