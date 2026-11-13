// triage-the-flaky-tests: three legacy tests fail now and then. One races the suggester, one needs
// another test to run first, and one reads the real time of day. The learner's fixed copy must pass
// 20 shuffled runs of each, with no retries and no sleeps, and qa/triage.json must name each cause
// and the person who approved the fix.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../scripts/structure";
import type { Rule } from "../scripts/verify";
import { once } from "./lib/memo";
import { allTests, type FoundTest, specFiles } from "./lib/static";
import { runSuite } from "./lib/suite";
import { withShop } from "./lib/world";

const STARTER_TESTS = join(
  ROOT,
  "parts",
  "03-keep-the-suite-healthy",
  "03-triage-the-flaky-tests",
  "problem",
  "tests",
);

// The three planted flaky tests and the cause planted in each.
const PLANTED: Record<string, string> = {
  "suggestions appear for out of stock milk": "race",
  "orders page lists my order": "shared-data",
  "next-date slots are open when the store clock is now": "clock",
};
const FLAKY_TITLES = Object.keys(PLANTED);
const RUNS_EACH = 20;
const NOT_A_PERSON = /^(claude|claude code|ai|agent|bot|healer|assistant)$/i;

type TriageEntry = {
  test?: string;
  cause?: string;
  evidence?: string;
  fix?: string;
  approvedBy?: string;
};

function flakyTestsIn(folder: string): Map<string, FoundTest> {
  const tests = allTests(join(folder, "tests"));
  const flaky = tests.filter((found) => FLAKY_TITLES.includes(found.title));
  return new Map(flaky.map((found) => [found.title, found]));
}

function everyFlakyTestKept(folder: string): boolean {
  const now = flakyTestsIn(folder);
  const before = flakyTestsIn(join(STARTER_TESTS, ".."));
  return FLAKY_TITLES.every((title) => {
    const fixed = now.get(title);
    const original = before.get(title);
    return Boolean(fixed && original && fixed.expects >= original.expects);
  });
}

// Escapes the titles so Playwright's --grep reads them as plain text.
function grepForFlakyTests(): string {
  const escaped = FLAKY_TITLES.map((title) => title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return escaped.join("|");
}

const shuffledRuns = (folder: string) =>
  once("triage-shuffled", folder, () =>
    withShop({}, (shop) =>
      runSuite(join(folder, "tests"), shop.url, {
        repeatEach: RUNS_EACH,
        grep: grepForFlakyTests(),
        args: ["--shuffle", "--max-failures=1"],
      }),
    ),
  );

async function passesEveryShuffledRun(folder: string): Promise<boolean> {
  const result = await shuffledRuns(folder);
  const expectedRuns = FLAKY_TITLES.length * RUNS_EACH;
  const bad = result.tests.filter((test) => test.status !== "passed");
  for (const test of bad.slice(0, 3)) console.log(`        ${test.status}: ${test.title}`);
  return result.tests.length === expectedRuns && bad.length === 0;
}

// Retries turn a red run green without fixing anything, so none may be added.
function noRetriesAdded(folder: string): boolean {
  const files = [...specFiles(join(folder, "tests")), join(folder, "playwright.config.ts")];
  const texts = files.filter(existsSync).map((file) => readFileSync(file, "utf8"));
  return texts.every((text) => !/\bretries\s*:\s*[1-9]/.test(text));
}

function noFixedSleeps(folder: string): boolean {
  const flaky = [...flakyTestsIn(folder).values()];
  return flaky.every((found) => !/\bwaitForTimeout\s*\(/.test(found.body));
}

// "new Date()" with nothing inside, or Date.now(), reads the real clock.
function clockTestUsesFixedTime(folder: string): boolean {
  const clockTest = flakyTestsIn(folder).get(
    "next-date slots are open when the store clock is now",
  );
  if (!clockTest) return false;
  return !/new Date\(\s*\)|Date\.now\(\)/.test(clockTest.body);
}

function readTriage(folder: string): TriageEntry[] {
  const path = join(folder, "qa", "triage.json");
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const filled = (text: string | undefined) => (text ?? "").trim().length > 0;

function entryIsComplete(entry: TriageEntry): boolean {
  const fields = [entry.test, entry.cause, entry.evidence, entry.fix, entry.approvedBy];
  return fields.every(filled);
}

function entryFor(folder: string, title: string): TriageEntry | undefined {
  return readTriage(folder).find((entry) => (entry.test ?? "").includes(title));
}

function triageIsComplete(folder: string): boolean {
  return FLAKY_TITLES.every((title) => {
    const entry = entryFor(folder, title);
    return entry !== undefined && entryIsComplete(entry);
  });
}

function causesMatch(folder: string): boolean {
  return FLAKY_TITLES.every((title) => entryFor(folder, title)?.cause === PLANTED[title]);
}

function approvedByPeople(folder: string): boolean {
  const entries = FLAKY_TITLES.map((title) => entryFor(folder, title));
  return entries.every((entry) => {
    const name = (entry?.approvedBy ?? "").trim();
    return name.length > 0 && !NOT_A_PERSON.test(name);
  });
}

export default [
  {
    says: "the 3 flaky tests are still there, with at least as many expects as before",
    test: everyFlakyTestKept,
    tryNext:
      "fix a flaky test, never delete it or drop its expect; the rule it checks still matters",
  },
  {
    says: `each flaky test passes ${RUNS_EACH} shuffled runs in a row`,
    test: passesEveryShuffledRun,
    tryNext:
      "run bunx playwright test --repeat-each=20 --shuffle --grep <title> and ask Claude Code " +
      "what is different in the runs that fail",
  },
  {
    says: "no retries were added",
    test: noRetriesAdded,
    tryNext: "take retries out; a retry hides the flake instead of fixing it",
  },
  {
    says: "the flaky tests use no fixed sleep (waitForTimeout)",
    test: noFixedSleeps,
    tryNext: "wait for what the shopper sees, such as expect(list).toContainText(...)",
  },
  {
    says: "the clock test sets a fixed store time instead of the real time",
    test: clockTestUsesFixedTime,
    tryNext: "set the store clock to a fixed moment, like 2026-03-10T15:00:00-05:00",
  },
  {
    says: "qa/triage.json has test, cause, evidence, fix and approvedBy for each flaky test",
    test: triageIsComplete,
    tryNext: "ask Claude Code for one JSON entry per flaky test, with all five fields",
  },
  {
    says: "each cause is right: race, shared-data or clock",
    test: causesMatch,
    tryNext: "read the evidence again: does the test wait, need another test, or read the time?",
  },
  {
    says: "every fix was approved by a person, not by the agent",
    test: approvedByPeople,
    tryNext: 'put your own name in approvedBy; "Claude Code" cannot approve its own fix',
  },
] satisfies Rule[];
