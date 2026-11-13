// explore-with-an-agent: a charter, and one repro test per bug the exploration found.
// A finding counts when its repro test passes on the fixed build and goes red with its bug on.
// The three bugs here break no written requirement, so only exploring finds them.
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Rule } from "../scripts/verify";
import { readText } from "./lib/markdown";
import { once } from "./lib/memo";
import { specFiles } from "./lib/static";
import { runSuite, type SuiteResult } from "./lib/suite";
import { withShop } from "./lib/world";

const UNWRITTEN_BUGS = ["double-book", "negative-qty", "back-resubmit"];
const CHARTER_SECTIONS = ["Mission", "Areas", "Time box"];
const FEWEST_FINDINGS = 2;

const exploreFolder = (folder: string) => join(folder, "qa", "explore");
const findingFiles = (folder: string) => specFiles(exploreFolder(folder));

// The text under "## <name>", up to the next heading of the same level.
function section(markdown: string, name: string): string {
  const parts = markdown.split(new RegExp(`^##\\s+${name}\\s*$`, "im"));
  if (parts.length < 2) return "";
  return parts[1].split(/^##\s/m)[0].trim();
}

function charterIsComplete(folder: string): boolean {
  const charter = readText(join(exploreFolder(folder), "charter.md"));
  return CHARTER_SECTIONS.every((name) => section(charter, name).length > 0);
}

function everyFileNamesItsFinding(folder: string): boolean {
  const files = findingFiles(folder);
  const namesFinding = (file: string) => /^\/\/\s*finding:\s*\S+/m.test(readFileSync(file, "utf8"));
  return files.length > 0 && files.every(namesFinding);
}

type Runs = { fixed: SuiteResult; withBug: Map<string, SuiteResult> };

function runEverywhere(folder: string): Promise<Runs> {
  return once("explore", folder, async () => {
    const testsFolder = exploreFolder(folder);
    const fixed = await withShop({ bugs: "none" }, (shop) => runSuite(testsFolder, shop.url));
    const withBug = new Map<string, SuiteResult>();
    for (const bug of UNWRITTEN_BUGS) {
      const result = await withShop({ bugs: bug }, (shop) => runSuite(testsFolder, shop.url));
      withBug.set(bug, result);
    }
    return { fixed, withBug };
  });
}

const failedIn = (result: SuiteResult, file: string) =>
  result.tests.some((test) => basename(test.file) === basename(file) && test.status !== "passed");

// The unwritten bugs that make this repro file go red.
async function bugsFoundBy(folder: string, file: string): Promise<string[]> {
  const { withBug } = await runEverywhere(folder);
  return UNWRITTEN_BUGS.filter((bug) => {
    const result = withBug.get(bug);
    return result !== undefined && failedIn(result, file);
  });
}

async function passesOnFixedBuild(folder: string): Promise<boolean> {
  const { fixed } = await runEverywhere(folder);
  return fixed.ran && fixed.failed === 0;
}

async function everyReproFindsItsBug(folder: string): Promise<boolean> {
  const files = findingFiles(folder);
  if (files.length === 0) return false;
  for (const file of files) {
    const found = await bugsFoundBy(folder, file);
    if (found.length === 0) return false;
  }
  return true;
}

async function findsEnoughBugs(folder: string): Promise<boolean> {
  const found = new Set<string>();
  for (const file of findingFiles(folder)) {
    for (const bug of await bugsFoundBy(folder, file)) found.add(bug);
  }
  console.log(`        Found ${found.size} of ${UNWRITTEN_BUGS.length}: ${[...found].join(", ")}`);
  return found.size >= FEWEST_FINDINGS;
}

export default [
  {
    says: "qa/explore/charter.md has a Mission, Areas and a Time box",
    test: charterIsComplete,
    tryNext: "ask Claude Code to fill in the three sections of the charter before it explores",
  },
  {
    says: "each repro test in qa/explore/ starts with a // finding: line",
    test: everyFileNamesItsFinding,
    tryNext: "write one .spec.ts per finding, with a line like // finding: the box accepts -1",
  },
  {
    says: "every repro test passes on the fixed build",
    test: passesOnFixedBuild,
    tryNext:
      "a repro test checks what should happen, not what the buggy shop did; " +
      "run it with BUGS=none and fix it",
  },
  {
    says: "every repro test goes red with its bug switched on",
    test: everyReproFindsItsBug,
    tryNext: "run the repro with the shop on BUGS=release; if it stays green, it checks nothing",
  },
  {
    says: "the repro tests find at least 2 of the 3 bugs no requirement names",
    test: findsEnoughBugs,
    tryNext: "explore again: try double clicks, odd numbers in boxes, and the Back button",
  },
] satisfies Rule[];
