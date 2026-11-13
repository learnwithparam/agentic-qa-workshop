// review-the-agent-tests: a verdict for every test the agent wrote, real fixes for the weak ones,
// and proof that the fixes now catch the bugs the weak tests let through.
import { basename, join } from "node:path";
import { ROOT } from "../scripts/structure";
import type { Rule } from "../scripts/verify";
import { norm, readText } from "./lib/markdown";
import { bugKillMatrix } from "./lib/matrix";
import { once } from "./lib/memo";
import { allTests, type FoundTest, testsIn } from "./lib/static";

const FIXTURE = join(ROOT, "checks", "fixtures", "review-the-agent-tests");
const AGENT_FILES = ["slots.spec.ts", "basket.spec.ts"];
const originalTests = AGENT_FILES.flatMap((file) => testsIn(join(FIXTURE, file)));
// The three weak tests planted in the agent's output, and the bug each one lets through.
const LET_THROUGH = ["weighted-price", "ghost-line", "promo-stacking"];
// A reason shorter than this many words does not really say why.
const FEWEST_WORDS_IN_A_REASON = 3;

// A review line looks like: - <test title>: keep | fix | drop: <why>
const VERDICT_LINE = /^\s*[-*]\s+(.+):\s*(keep|fix|drop)\s*(?::\s*(.*))?$/i;

type Verdict = { title: string; verdict: "keep" | "fix" | "drop"; why: string };

function verdictOnLine(line: string): Verdict[] {
  const match = VERDICT_LINE.exec(line);
  if (!match) return [];
  const [, title, verdict, why] = match;
  return [
    {
      title: title.trim(),
      verdict: verdict.toLowerCase() as Verdict["verdict"],
      why: (why ?? "").trim(),
    },
  ];
}

function verdicts(folder: string): Verdict[] {
  const lines = readText(join(folder, "qa", "review.md")).split("\n");
  return lines.flatMap(verdictOnLine);
}

const reviewedTests = (folder: string) =>
  allTests(join(folder, "tests")).filter((testCase) => basename(testCase.file) !== "seed.spec.ts");

const withoutSpaces = (text: string) => text.replace(/\s+/g, "");

const bugMatrix = (folder: string) =>
  once("review", folder, () => bugKillMatrix(join(folder, "tests"), LET_THROUGH, 3));

const testsByTitle = (tests: FoundTest[]) =>
  new Map(tests.map((testCase) => [norm(testCase.title), testCase]));

function everyAgentTestHasVerdict(folder: string): boolean {
  const reviewedTitles = new Set(verdicts(folder).map((verdict) => norm(verdict.title)));
  return originalTests.every((testCase) => reviewedTitles.has(norm(testCase.title)));
}

function everyReasonSaysWhy(folder: string): boolean {
  const notKept = verdicts(folder).filter((verdict) => verdict.verdict !== "keep");
  return notKept.every((verdict) => verdict.why.split(/\s+/).length >= FEWEST_WORDS_IN_A_REASON);
}

function verdictWasCarriedOut(
  verdict: Verdict,
  testsNow: Map<string, FoundTest>,
  testsBefore: Map<string, FoundTest>,
): boolean {
  const title = norm(verdict.title);
  if (verdict.verdict === "drop") return !testsNow.has(title);
  if (verdict.verdict !== "fix") return true;
  const testNow = testsNow.get(title);
  const testBefore = testsBefore.get(title);
  if (!(testNow && testBefore)) return false;
  return withoutSpaces(testNow.body) !== withoutSpaces(testBefore.body);
}

function everyVerdictWasCarriedOut(folder: string): boolean {
  const testsNow = testsByTitle(reviewedTests(folder));
  const testsBefore = testsByTitle(originalTests);
  return verdicts(folder).every((verdict) => verdictWasCarriedOut(verdict, testsNow, testsBefore));
}

async function suitePassesOnFixedBuild(folder: string): Promise<boolean> {
  const matrix = await bugMatrix(folder);
  return matrix.baseline.ran && matrix.baseline.failed === 0;
}

async function suiteCatchesTheLetThroughBugs(folder: string): Promise<boolean> {
  const matrix = await bugMatrix(folder);
  return matrix.caught === LET_THROUGH.length;
}

export default [
  {
    says: "qa/review.md gives every agent test a verdict: keep, fix or drop",
    test: everyAgentTestHasVerdict,
    tryNext: "add one line per test: - <test title>: keep | fix | drop: <why>",
  },
  {
    says: "at least one test is marked fix or drop",
    test: (folder) => verdicts(folder).some((verdict) => verdict.verdict !== "keep"),
    tryNext:
      "read each test next to its scenario's Expected part; " +
      "a test that checks a toast is not checking the price",
  },
  {
    says: "every fix and drop says why",
    test: everyReasonSaysWhy,
    tryNext:
      "after the verdict, say in a few words what the test missed, such as: only checked the toast",
  },
  {
    says: "every test marked fix was changed, and every test marked drop is gone",
    test: everyVerdictWasCarriedOut,
    tryNext:
      "edit the test you marked fix (or delete the one you marked drop), then run the check again",
  },
  {
    says: "the reviewed suite passes on the fixed build",
    test: suitePassesOnFixedBuild,
    tryNext: "run bunx playwright test in this folder and fix each red test",
  },
  {
    says: "the reviewed suite now catches weighted-price, ghost-line and promo-stacking",
    test: suiteCatchesTheLetThroughBugs,
    tryNext:
      "start the shop with BUGS=weighted-price bun run shop " +
      "and find the test that should go red; make it check the number the shopper pays",
  },
] satisfies Rule[];
