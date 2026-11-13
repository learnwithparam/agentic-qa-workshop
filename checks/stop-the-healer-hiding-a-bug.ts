// stop-the-healer-hiding-a-bug: release v2 starts new basket lines with substitutes off, which
// breaks SUB-1. The SUB-1 test must stay red on v2 and green on v1, with its assertion intact,
// and the learner files a bug report with Steps, Expected, Actual and Requirement.
import { join } from "node:path";
import {
  hasSkippedTest,
  weakenedTests,
} from "../parts/03-keep-the-suite-healthy/helpers/tests-kept";
import { ROOT } from "../scripts/structure";
import type { Rule } from "../scripts/verify";
import { readText } from "./lib/markdown";
import { once } from "./lib/memo";
import { allTests } from "./lib/static";
import { runSuite } from "./lib/suite";
import { withShop } from "./lib/world";

const STARTER_TESTS = join(
  ROOT,
  "parts",
  "03-keep-the-suite-healthy",
  "02-stop-the-healer-hiding-a-bug",
  "problem",
  "tests",
);
const SUB_ONE_TEST = "A new line allows substitutes and an out-of-stock item is replaced";
const REPORT_SECTIONS = ["Steps", "Expected", "Actual", "Requirement"];

type Release = "v1" | "v2";

function runSubOneTest(folder: string, release: Release) {
  return once(`sub-one-${release}`, folder, () =>
    withShop({ release }, (shop) =>
      runSuite(join(folder, "tests"), shop.url, { grep: "A new line allows substitutes" }),
    ),
  );
}

async function subOneResult(folder: string, release: Release) {
  const result = await runSubOneTest(folder, release);
  return result.tests.find((test) => test.title === SUB_ONE_TEST);
}

async function subOneFailsOnReleaseTwo(folder: string): Promise<boolean> {
  const subOne = await subOneResult(folder, "v2");
  return subOne?.status === "failed";
}

// Playwright colours its messages, so the colour codes are taken out before we read them.
const ESCAPE = String.fromCharCode(27);
const COLOUR_CODE = new RegExp(`${ESCAPE}\\[[0-9;]*m`, "g");
const withoutColours = (text: string) => text.replace(COLOUR_CODE, "");

// The test must fail at the substitutes check, not at a locator that broke on the way there.
async function failsAtTheDefault(folder: string): Promise<boolean> {
  const subOne = await subOneResult(folder, "v2");
  const message = withoutColours(subOne?.error ?? "");
  return message.includes("toBeChecked");
}

function subOneStillAssertsTheDefault(folder: string): boolean {
  const subOne = allTests(join(folder, "tests")).find((test) => test.title === SUB_ONE_TEST);
  if (!subOne) return false;
  const assertsChecked = /Allow substitutes for [^"]+"\)\)\.toBeChecked\(\)/.test(subOne.body);
  return assertsChecked && weakenedTests(STARTER_TESTS, join(folder, "tests")).length === 0;
}

const reportText = (folder: string) => readText(join(folder, "qa", "bugs", "SUB-1.md"));

// The text under one "## <name>" heading, up to the next heading of the same level.
function section(markdown: string, name: string): string {
  const parts = markdown.split(/^## /m);
  const wanted = name.toLowerCase();
  const found = parts.find((part) => part.toLowerCase().startsWith(wanted));
  return found ? found.slice(name.length).trim() : "";
}

function reportHasEverySection(folder: string): boolean {
  const report = reportText(folder);
  return REPORT_SECTIONS.every((name) => section(report, name).length > 0);
}

function reportNamesTheRule(folder: string): boolean {
  const report = reportText(folder);
  const requirement = section(report, "Requirement");
  const expected = section(report, "Expected");
  return requirement.includes("SUB-1") && /switched on|allow substitutes/i.test(expected);
}

export default [
  {
    says: "the SUB-1 test still fails on release v2",
    test: subOneFailsOnReleaseTwo,
    tryNext:
      `keep "${SUB_ONE_TEST}" as it was; ` +
      "a green test on v2 means the healer hid the regression",
  },
  {
    says: "it fails where it checks that Allow substitutes starts on, so for the right reason",
    test: failsAtTheDefault,
    tryNext: "run the test alone on v2 and read the error; it must stop at toBeChecked",
  },
  {
    says: "the SUB-1 test still expects Allow substitutes to be checked, and no test was weakened",
    test: subOneStillAssertsTheDefault,
    tryNext: "undo any change to an expect; the guard log or git diff tests/ shows which one",
  },
  {
    says: "no test is marked test.skip or test.fixme",
    test: (folder) => !hasSkippedTest(join(folder, "tests")),
    tryNext: "a fixme hides the bug from every later run; keep the test red and report the bug",
  },
  {
    says: "qa/bugs/SUB-1.md has Steps, Expected, Actual and Requirement",
    test: reportHasEverySection,
    tryNext:
      "ask Claude Code for the four headings: ## Steps, ## Expected, ## Actual, ## Requirement",
  },
  {
    says: "the report names SUB-1 and quotes what it expects",
    test: reportNamesTheRule,
    tryNext:
      "under Requirement write SUB-1; under Expected quote the rule: " +
      'new lines start with "Allow substitutes" switched on',
  },
] satisfies Rule[];
