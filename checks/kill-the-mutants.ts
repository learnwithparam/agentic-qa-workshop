// kill-the-mutants: Stryker plants small faults (mutants) in the domain code and runs the learner's
// Vitest tests against each one. A mutant is killed when a test goes red.
// The check copies the learner's tests next to a fixed copy of the domain code, so editing the
// domain code to make tests pass changes nothing. Then it runs Stryker and reads its JSON report.

import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { ROOT } from "../scripts/structure";
import type { Rule } from "../scripts/verify";
import { once } from "./lib/memo";

const FIXED_DOMAIN = join(ROOT, "checks", "fixtures", "kill-the-mutants", "domain");
const MUTATED_FILES = ["domain/slots.ts", "domain/basket.ts", "domain/substitutions.ts"];
const LOWEST_BREAK = 70;
const LOWEST_SCORE = 70;

type MutantReport = { status: string; killedBy?: string[] };
type FileReport = { mutants: MutantReport[] };
type TestFileReport = { tests: { id: string; name: string }[] };
type StrykerReport = {
  files: Record<string, FileReport>;
  testFiles?: Record<string, TestFileReport>;
};
type StrykerConfig = {
  testRunner?: string;
  mutate?: string[];
  thresholds?: { break?: number | null };
};

// Vitest finds the tests next to the domain code, like the starter's vitest.config.ts.
const VITEST_CONFIG = [
  'import { defineConfig } from "vitest/config";',
  'export default defineConfig({ test: { include: ["domain/**/*.test.ts"] } });',
  "",
].join("\n");

const DETECTED = new Set(["Killed", "Timeout"]);
const UNDETECTED = new Set(["Survived", "NoCoverage"]);

function learnerTestFiles(folder: string): string[] {
  const domainFolder = join(folder, "domain");
  if (!existsSync(domainFolder)) return [];
  const names = readdirSync(domainFolder);
  return names.filter((name) => name.endsWith(".test.ts"));
}

function readConfig(folder: string): StrykerConfig | null {
  const path = join(folder, "stryker.config.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function configIsSound(folder: string): boolean {
  const config = readConfig(folder);
  if (!config) return false;
  const breakAt = config.thresholds?.break ?? 0;
  const mutated = (config.mutate ?? []).join(" ");
  const coversEveryFile = MUTATED_FILES.every((file) => mutated.includes(file));
  return config.testRunner === "vitest" && breakAt >= LOWEST_BREAK && coversEveryFile;
}

// A private folder under .runs: the fixed domain code plus only the learner's test files.
function makeWorkspace(folder: string): string {
  const fingerprint = createHash("sha256").update(folder).digest("hex").slice(0, 12);
  const workspace = join(ROOT, ".runs", "kill-the-mutants", fingerprint);
  rmSync(workspace, { recursive: true, force: true });
  mkdirSync(workspace, { recursive: true });
  cpSync(FIXED_DOMAIN, join(workspace, "domain"), { recursive: true });
  for (const testFile of learnerTestFiles(folder)) {
    cpSync(join(folder, "domain", testFile), join(workspace, "domain", testFile));
  }
  writeFileSync(join(workspace, "vitest.config.ts"), VITEST_CONFIG);
  return workspace;
}

function runQuietly(command: string[], workspace: string) {
  return Bun.spawn(command, { cwd: workspace, stdout: "ignore", stderr: "ignore" }).exited;
}

// The check's own Stryker settings: always the same three files and a JSON report it can read.
function writeStrykerConfig(workspace: string) {
  const config = {
    testRunner: "vitest",
    mutate: MUTATED_FILES,
    reporters: ["json"],
    jsonReporter: { fileName: "mutation.json" },
    coverageAnalysis: "perTest",
    thresholds: { high: 80, low: 60, break: null },
    tempDirName: ".stryker-tmp",
    cleanTempDir: "always",
  };
  writeFileSync(join(workspace, "stryker.config.json"), JSON.stringify(config, null, 2));
}

type Run = { testsPass: boolean; report: StrykerReport | null };

async function runEverything(folder: string): Promise<Run> {
  if (learnerTestFiles(folder).length === 0) return { testsPass: false, report: null };
  const workspace = makeWorkspace(folder);
  const vitestExit = await runQuietly(["bun", "x", "vitest", "run"], workspace);
  if (vitestExit !== 0) return { testsPass: false, report: null };
  writeStrykerConfig(workspace);
  await runQuietly(["bun", "x", "stryker", "run"], workspace);
  const reportPath = join(workspace, "mutation.json");
  const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) : null;
  return { testsPass: true, report };
}

const runFor = (folder: string) => once("kill-the-mutants", folder, () => runEverything(folder));

function allMutants(report: StrykerReport): MutantReport[] {
  const files = Object.values(report.files);
  return files.flatMap((file) => file.mutants);
}

export function mutationScore(report: StrykerReport): number {
  const mutants = allMutants(report);
  const detected = mutants.filter((mutant) => DETECTED.has(mutant.status)).length;
  const undetected = mutants.filter((mutant) => UNDETECTED.has(mutant.status)).length;
  const counted = detected + undetected;
  if (counted === 0) return 0;
  return (100 * detected) / counted;
}

// Test ids that killed at least one mutant.
function killerIds(report: StrykerReport): Set<string> {
  const killers = allMutants(report).flatMap((mutant) => mutant.killedBy ?? []);
  return new Set(killers);
}

function everyTestFileKills(report: StrykerReport): boolean {
  const killers = killerIds(report);
  const testFiles = Object.values(report.testFiles ?? {});
  if (testFiles.length === 0) return false;
  return testFiles.every((testFile) => testFile.tests.some((test) => killers.has(test.id)));
}

async function testsPassOnFixedCode(folder: string): Promise<boolean> {
  const run = await runFor(folder);
  return run.testsPass;
}

async function scoreIsHighEnough(folder: string): Promise<boolean> {
  const run = await runFor(folder);
  if (!run.report) return false;
  const score = mutationScore(run.report);
  console.log(`        mutation score: ${score.toFixed(1)} (needs ${LOWEST_SCORE})`);
  return score >= LOWEST_SCORE;
}

async function everyFileKillsSomething(folder: string): Promise<boolean> {
  const run = await runFor(folder);
  return run.report !== null && everyTestFileKills(run.report);
}

export default [
  {
    says: "stryker.config.json uses vitest, mutates the three domain files, and breaks below 70",
    test: configIsSound,
    tryNext:
      'ask Claude Code for a stryker.config.json with "testRunner": "vitest", ' +
      'the three domain files in "mutate", and "thresholds": { "break": 70 }',
  },
  {
    says: "your unit tests pass on the fixed domain code",
    test: testsPassOnFixedCode,
    tryNext: "run bunx vitest run here; a test that is red on correct code expects a wrong number",
  },
  {
    says: `the mutation score on the three domain files is at least ${LOWEST_SCORE}`,
    test: scoreIsHighEnough,
    tryNext:
      "run bunx stryker run, read each Survived block, and give Claude Code one survived " +
      "mutant at a time: write a test that goes red on this change",
  },
  {
    says: "every test file kills at least one mutant",
    test: everyFileKillsSomething,
    tryNext: "a test file that kills nothing checks nothing; make its expects compare exact values",
  },
] satisfies Rule[];
