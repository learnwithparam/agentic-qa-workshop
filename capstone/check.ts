// run-agents-on-your-own-app: the "do it on yours" capstone.
// The learner runs Playwright's planner and generator (and the healer if a test broke)
// on their OWN app. This check never opens the course shop. It reads the learner's files only.
// It proves the shape of the work and that evidence exists: a saved report with every test green.
// Run: bun capstone/check.ts <your folder>
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readText, scenarios } from "../checks/lib/markdown";
import { allTests, specFiles } from "../checks/lib/static";
import type { Rule } from "../scripts/verify";

const SECTIONS = [
  "My app",
  "The flow",
  "What the planner found",
  "What I approved",
  "What I rejected",
];
const WORDS_PER_SECTION = 12;
const NOT_A_PERSON = /^(claude|claude code|ai|agent|bot|planner|generator|healer|assistant)$/i;
// Anything from the course world means the learner copied the example, not their own app.
const COURSE_WORLD = /pantry|localhost:4173|__test\/reset|ana@pantryrun/i;

const mine = (folder: string) => folder;

const notesPath = (folder: string) => join(mine(folder), "MY-APP.md");
const evidencePath = (folder: string) => join(mine(folder), "evidence.json");

type Evidence = {
  appUrl?: string;
  approvedBy?: string;
  agents?: string[];
  report?: string;
  healed?: { test?: string; change?: string }[];
};

function readEvidence(folder: string): Evidence | null {
  try {
    return JSON.parse(readText(evidencePath(folder))) as Evidence;
  } catch {
    return null;
  }
}

// The text under one "## heading", up to the next "## " heading.
function sectionText(markdown: string, heading: string): string {
  const lines = markdown.split("\n");
  const start = lines.findIndex(
    (line) => line.trim().toLowerCase() === `## ${heading}`.toLowerCase(),
  );
  if (start < 0) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line));
  return (end < 0 ? rest : rest.slice(0, end)).join("\n").trim();
}

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

function notesAreFilledIn(folder: string): boolean {
  const notes = readText(notesPath(folder));
  if (!notes || /\bTODO\b/.test(notes)) return false;
  return SECTIONS.every((heading) => wordCount(sectionText(notes, heading)) >= WORDS_PER_SECTION);
}

function ownFiles(folder: string): string[] {
  const root = mine(folder);
  const files = [notesPath(folder), evidencePath(folder), join(root, "playwright.config.ts")];
  return [...files, ...specFiles(join(root, "tests"))].filter(existsSync);
}

function isNotTheCourseWorld(folder: string): boolean {
  const files = ownFiles(folder);
  if (files.length < 3) return false;
  return files.every((file) => !COURSE_WORLD.test(readFileSync(file, "utf8")));
}

function planFiles(folder: string): string[] {
  const dir = join(mine(folder), "plans");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => join(dir, name));
}

function planHasScenarios(folder: string): boolean {
  return planFiles(folder).some((file) => scenarios(readFileSync(file, "utf8")).length >= 3);
}

function generatedTests(folder: string) {
  return allTests(join(mine(folder), "tests"));
}

function everyTestChecksSomething(folder: string): boolean {
  const tests = generatedTests(folder);
  const noSleeps = tests.every((found) => !/\bwaitForTimeout\s*\(/.test(found.body));
  return tests.length >= 3 && noSleeps && tests.every((found) => found.expects > 0);
}

function specsNameTheirPlan(folder: string): boolean {
  const files = specFiles(join(mine(folder), "tests")).filter(
    (file) => !/seed\.spec\.ts$/.test(file),
  );
  const namesItsPlan = (file: string) =>
    /^\/\/\s*spec:\s*plans\/.+\.md/m.test(readFileSync(file, "utf8"));
  return files.length > 0 && files.every(namesItsPlan);
}

function seedUsesTheBaseUrl(folder: string): boolean {
  const config = readText(join(mine(folder), "playwright.config.ts"));
  const seed = readText(join(mine(folder), "tests", "seed.spec.ts"));
  const configReadsUrl = /baseURL\s*:/.test(config) && /process\.env\.\w*URL/.test(config);
  return configReadsUrl && /expect\(/.test(seed) && !/https?:\/\//.test(seed);
}

type Report = {
  stats?: { expected?: number; unexpected?: number; flaky?: number };
  suites?: ReportSuite[];
};
type ReportSuite = { specs?: { title: string }[]; suites?: ReportSuite[] };

function reportTitles(suites: ReportSuite[] | undefined): string[] {
  const titles: string[] = [];
  for (const suite of suites ?? []) {
    titles.push(...(suite.specs ?? []).map((spec) => spec.title));
    titles.push(...reportTitles(suite.suites));
  }
  return titles;
}

function readReport(folder: string): Report | null {
  const path = readEvidence(folder)?.report;
  if (!path || path.startsWith("/") || path.includes("..")) return null;
  try {
    return JSON.parse(readText(join(mine(folder), path))) as Report;
  } catch {
    return null;
  }
}

function reportIsGreen(folder: string): boolean {
  const stats = readReport(folder)?.stats;
  return (stats?.expected ?? 0) >= 3 && stats?.unexpected === 0 && stats?.flaky === 0;
}

// The saved report must list the tests that are in the folder now, so it is not an old report.
function reportMatchesTheTests(folder: string): boolean {
  const report = readReport(folder);
  if (!report) return false;
  const inReport = new Set(reportTitles(report.suites));
  return generatedTests(folder).every((found) => inReport.has(found.title));
}

function evidenceIsComplete(folder: string): boolean {
  const evidence = readEvidence(folder);
  if (!evidence) return false;
  const url = evidence.appUrl ?? "";
  const agents = evidence.agents ?? [];
  const healedNeedsHealer = (evidence.healed ?? []).length === 0 || agents.includes("healer");
  const person = (evidence.approvedBy ?? "").trim();
  return (
    /^https?:\/\/\S+$/.test(url) &&
    agents.includes("planner") &&
    agents.includes("generator") &&
    healedNeedsHealer &&
    person.length > 0 &&
    !NOT_A_PERSON.test(person)
  );
}

const rules = [
  {
    says: "MY-APP.md has all five sections, each with a real answer and no TODO",
    test: notesAreFilledIn,
    tryNext:
      "write a few sentences under each heading in MY-APP.md, from My app to What I rejected",
  },
  {
    says: "the files describe your own app, not the Pantry Run course shop",
    test: isNotTheCourseWorld,
    tryNext:
      "point the config at your own app URL and remove every Pantry Run name from your files",
  },
  {
    says: "plans/ holds a plan with at least 3 scenarios",
    test: planHasScenarios,
    tryNext: "ask the planner agent to save a plan in plans/ with 3 or more scenarios",
  },
  {
    says: "tests/seed.spec.ts uses the base URL from playwright.config.ts and has an expect",
    test: seedUsesTheBaseUrl,
    tryNext:
      "read the app URL from an environment variable in the config, and end the seed on an expect",
  },
  {
    says: "each generated spec names its plan with a // spec: plans/ line",
    test: specsNameTheirPlan,
    tryNext: "ask the generator agent to start each spec with // spec: plans/<name>.md",
  },
  {
    says: "there are at least 3 tests, each with an expect and no fixed sleep",
    test: everyTestChecksSomething,
    tryNext: "add an expect to each test and wait for what the user sees instead of waitForTimeout",
  },
  {
    says: "evidence.json names your app URL, the agents you used and the person who approved",
    test: evidenceIsComplete,
    tryNext:
      "fill appUrl, agents (planner, generator, healer if used), and approvedBy with your name",
  },
  {
    says: "the saved Playwright report shows every test green, with no flaky run",
    test: reportIsGreen,
    tryNext: "run bunx playwright test --reporter=json > evidence/report.json and fix any red test",
  },
  {
    says: "the saved report lists every test that is in tests/ today",
    test: reportMatchesTheTests,
    tryNext: "run the tests again and save a new report, so it matches the files you have now",
  },
] satisfies Rule[];

export default rules;

const here = import.meta.dir;

async function grade(folder: string): Promise<boolean> {
  let allPass = true;
  for (const rule of rules) {
    let ok = false;
    try {
      ok = await rule.test(folder);
    } catch {
      ok = false;
    }
    if (ok) console.log(`  PASS  ${rule.says}`);
    else {
      allPass = false;
      console.log(`  FAIL  ${rule.says}\n        Try next: ${rule.tryNext}`);
    }
  }
  return allPass;
}

// bun capstone/check.ts --wrong: every folder in capstone/wrong must fail.
async function provedWrong(): Promise<number> {
  const root = join(here, "wrong");
  let bad = 0;
  for (const name of readdirSync(root)) {
    const quiet = console.log;
    console.log = () => {};
    const passed = await grade(join(root, name));
    console.log = quiet;
    if (passed) {
      console.log(`wrong/${name} PASSES, so the check misses that mistake`);
      bad += 1;
    }
  }
  if (bad === 0) console.log("Every wrong answer fails, as it should.");
  return bad === 0 ? 0 : 1;
}

async function main(): Promise<number> {
  const arg = process.argv[2];
  if (arg === "--wrong") return provedWrong();
  if (!arg) {
    console.log("Give the folder to check: bun capstone/check.ts <your folder>");
    return 2;
  }
  const passed = await grade(arg);
  console.log(passed ? "Done. All rules pass." : "Not done yet. See the FAIL lines above.");
  return passed ? 0 : 1;
}

if (import.meta.main) process.exit(await main());
