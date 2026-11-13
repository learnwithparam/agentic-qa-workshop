// check-looks-and-access: a screenshot test must catch the price that sits on its button on a phone
// (price-overlap), and an axe test must catch the slot radios with no name (missing-label).
// Screenshots differ from machine to machine, so the check never trusts the learner's saved images.
// It copies the tests to a private folder, makes fresh baselines on the fixed build, and then
// compares: green again on the fixed build, red with the bug on.

import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../scripts/structure";
import type { Rule } from "../scripts/verify";
import { once } from "./lib/memo";
import { runSuite, type SuiteResult } from "./lib/suite";
import { withShop } from "./lib/world";

const VISUAL = "visual.spec.ts";
const ACCESS = "a11y.spec.ts";
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const testsFolder = (folder: string) => join(folder, "tests");
const readTest = (folder: string, name: string) => {
  const path = join(testsFolder(folder), name);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
};

// A private copy of the test files and their helpers, with no saved screenshots.
function privateCopy(folder: string, specName: string): string {
  const fingerprint = createHash("sha256").update(`${folder}|${specName}`).digest("hex");
  const copy = join(ROOT, ".runs", "check-looks-and-access", fingerprint.slice(0, 12));
  rmSync(copy, { recursive: true, force: true });
  mkdirSync(copy, { recursive: true });
  for (const entry of readdirSync(testsFolder(folder))) {
    const isHelper = entry.endsWith(".ts") && !entry.endsWith(".spec.ts");
    if (entry === specName || isHelper) cpSync(join(testsFolder(folder), entry), join(copy, entry));
  }
  return copy;
}

type Verdicts = { baselineMade: boolean; greenWhenFixed: boolean; redWithBug: boolean };

const ranGreen = (result: SuiteResult) => result.ran && result.failed === 0;
const ranRed = (result: SuiteResult) => result.ran && result.failed > 0;

async function judge(folder: string, specName: string, bug: string): Promise<Verdicts> {
  if (!readTest(folder, specName)) {
    return { baselineMade: false, greenWhenFixed: false, redWithBug: false };
  }
  const copy = privateCopy(folder, specName);
  const fixed = await withShop({}, async (shop) => {
    const baseline = await runSuite(copy, shop.url, { args: ["--update-snapshots=all"] });
    const again = await runSuite(copy, shop.url);
    return { baselineMade: ranGreen(baseline), greenWhenFixed: ranGreen(again) };
  });
  const withBug = await withShop({ bugs: bug }, (shop) => runSuite(copy, shop.url));
  return { ...fixed, redWithBug: ranRed(withBug) };
}

const visualVerdicts = (folder: string) =>
  once("looks-visual", folder, () => judge(folder, VISUAL, "price-overlap"));
const accessVerdicts = (folder: string) =>
  once("looks-access", folder, () => judge(folder, ACCESS, "missing-label"));

function visualTestShape(folder: string): boolean {
  const source = readTest(folder, VISUAL);
  const takesScreenshots = /toHaveScreenshot\s*\(/.test(source);
  return takesScreenshots && source.includes("375");
}

function accessTestShape(folder: string): boolean {
  const source = readTest(folder, ACCESS);
  const usesAxe = source.includes("@axe-core/playwright") && source.includes("AxeBuilder");
  return usesAxe && WCAG_TAGS.every((tag) => source.includes(`"${tag}"`));
}

// A rule turned off needs a ticket on the same line or the line above, like "// PANTRY-123".
function everyDisabledRuleHasTicket(folder: string): boolean {
  const lines = readTest(folder, ACCESS).split("\n");
  return lines.every((line, index) => {
    const isComment = line.trim().startsWith("//");
    if (isComment || !/disableRules\s*\(/.test(line)) return true;
    const nearby = `${lines[index - 1] ?? ""} ${line}`;
    return /\/\/.*\b[A-Z]+-\d+\b/.test(nearby);
  });
}

export default [
  {
    says: "tests/visual.spec.ts takes screenshots with toHaveScreenshot, at 375 px among others",
    test: visualTestShape,
    tryNext: "ask Claude Code for toHaveScreenshot of the product card at 375 px and 1280 px",
  },
  {
    says: "the visual test makes its baselines and passes again on the fixed build",
    test: async (folder) => {
      const verdicts = await visualVerdicts(folder);
      return verdicts.baselineMade && verdicts.greenWhenFixed;
    },
    tryNext:
      "a screenshot that changes between runs is flaky; reset the shop data before each test",
  },
  {
    says: "the visual test goes red when a price sits on its Add button (price-overlap)",
    test: async (folder) => (await visualVerdicts(folder)).redWithBug,
    tryNext: "the bug shows only on a phone; take the product card screenshot at 375 px wide",
  },
  {
    says: "tests/a11y.spec.ts runs axe with the WCAG 2.1 AA tags",
    test: accessTestShape,
    tryNext: "use AxeBuilder from @axe-core/playwright with wcag2a, wcag2aa, wcag21a and wcag21aa",
  },
  {
    says: "the accessibility test passes on the fixed build",
    test: async (folder) => (await accessVerdicts(folder)).greenWhenFixed,
    tryNext: "run bunx playwright test tests/a11y.spec.ts and read the violation ids it prints",
  },
  {
    says: "the accessibility test goes red when the slot radios have no name (missing-label)",
    test: async (folder) => (await accessVerdicts(folder)).redWithBug,
    tryNext: "scan the slot picker on /slots, signed in; do not turn the label rule off",
  },
  {
    says: "any axe rule turned off has a comment that names a ticket",
    test: everyDisabledRuleHasTicket,
    tryNext: "add a comment such as // PANTRY-123 next to disableRules, or turn the rule back on",
  },
] satisfies Rule[];
