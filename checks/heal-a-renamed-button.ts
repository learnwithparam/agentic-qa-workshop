// heal-a-renamed-button: release v2 renames "Book slot" to "Reserve" and moves the slot picker
// into a dialog. The healed suite must pass on v2 again, except the substitution tests that the
// real SUB-1 regression breaks. And healing may only change how a test finds things:
// no test removed, no expect removed, no expected value changed, no skip or fixme.
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
  hasSkippedTest,
  weakenedTests,
} from "../parts/03-keep-the-suite-healthy/helpers/tests-kept";
import { ROOT } from "../scripts/structure";
import type { Rule } from "../scripts/verify";
import { once } from "./lib/memo";
import { allTests, CSS_OR_XPATH } from "./lib/static";
import { runSuite } from "./lib/suite";
import { withShop } from "./lib/world";

const STARTER_TESTS = join(
  ROOT,
  "parts",
  "03-keep-the-suite-healthy",
  "01-heal-a-renamed-button",
  "problem",
  "tests",
);
// On v2 new lines start with substitutes off (SUB-1), so these tests stay red for a real reason.
const BROKEN_BY_SUB_ONE = "substitutions.spec.ts";

const runOnReleaseTwo = (folder: string) =>
  once("heal-on-v2", folder, () =>
    withShop({ release: "v2" }, (shop) => runSuite(join(folder, "tests"), shop.url)),
  );

async function locatorFailuresAreHealed(folder: string): Promise<boolean> {
  const result = await runOnReleaseTwo(folder);
  if (!result.ran) return false;
  const mustPass = result.tests.filter((test) => basename(test.file) !== BROKEN_BY_SUB_ONE);
  const stillRed = mustPass.filter((test) => test.status !== "passed");
  for (const test of stillRed) console.log(`        still red on v2: ${test.title}`);
  return mustPass.length > 0 && stillRed.length === 0;
}

function everyTestKept(folder: string): boolean {
  const weakened = weakenedTests(STARTER_TESTS, join(folder, "tests"));
  for (const problem of weakened) console.log(`        "${problem.title}": ${problem.why}`);
  return weakened.length === 0;
}

function noLocatorTiedToMarkup(folder: string): boolean {
  const tests = allTests(join(folder, "tests"));
  return tests.every((found) => !CSS_OR_XPATH.test(found.body));
}

function guardStillWired(folder: string): boolean {
  const settingsPath = join(folder, ".claude", "settings.json");
  if (!existsSync(settingsPath)) return false;
  return readFileSync(settingsPath, "utf8").includes("qa/guard.ts");
}

export default [
  {
    says: "every test that failed only on a renamed or moved element passes on release v2",
    test: locatorFailuresAreHealed,
    tryNext:
      "start the shop with RELEASE=v2 bun run shop, run bunx playwright test, and ask the " +
      "playwright-test-healer agent to fix the red tests outside substitutions.spec.ts",
  },
  {
    says: "every test is still there, with every expect and every expected value",
    test: everyTestKept,
    tryNext:
      "a heal changes how a test finds things, never what it expects; undo the edit named above",
  },
  {
    says: "no test is marked test.skip or test.fixme",
    test: (folder) => !hasSkippedTest(join(folder, "tests")),
    tryNext: "a skipped test hides the bug it was written for; take the skip or fixme out",
  },
  {
    says: "healed locators use roles, labels and text, not CSS or XPath",
    test: noLocatorTiedToMarkup,
    tryNext: 'ask for getByRole("button", { name: "Reserve" }) instead of a CSS selector',
  },
  {
    says: "the guard hook from Part 2 is still in .claude/settings.json",
    test: guardStillWired,
    tryNext: "put back the PreToolUse hook that runs qa/guard.ts; the healer must run with it on",
  },
] satisfies Rule[];
