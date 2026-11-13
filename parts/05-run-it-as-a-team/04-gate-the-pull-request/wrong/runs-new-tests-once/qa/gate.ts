// bun run gate <pull-folder>: decides if a pull request may merge.
// The pull folder holds the suite as the pull request leaves it (tests/) and the mutation report
// Stryker wrote for it (reports/mutation/mutation.json). This folder's own tests/ is main.
// Stages run cheapest first and stop at the first block:
//   1. guard        no test checks less than before (qa/guard.ts on each file's diff)
//   2. mutation     the mutation score is at or above Stryker's break threshold
//   3. suite        every test passes on the fixed build
//   4. steady       every new test passes one run on the fixed build
//   5. catches      every new test goes red on at least one planted requirement bug
// Exit 0: merge. Exit 1: blocked. With --scorecard <file> it also writes the numbers as JSON.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { reasonToReject } from "./guard";

const HERE = resolve(import.meta.dir, "..");
const REQUIREMENT_BUGS = [
  "slot-cutoff",
  "slot-capacity",
  "weighted-price",
  "promo-stacking",
  "min-order",
  "ghost-line",
  "sub-allergen",
  "sub-optout-chilled",
];
const STEADY_RUNS = 1;

type Numbers = Record<string, number | string>;
type Stage = { name: string; passed: boolean; says: string };

// The course repo's root: the first folder above this one that holds world/server.ts.
function courseRoot(): string {
  let folder = HERE;
  while (!existsSync(join(folder, "world", "server.ts"))) {
    const parent = dirname(folder);
    if (parent === folder) throw new Error("Run the gate inside the course repo.");
    folder = parent;
  }
  return folder;
}

function specNames(testsFolder: string): string[] {
  if (!existsSync(testsFolder)) return [];
  return readdirSync(testsFolder).filter((name) => name.endsWith(".spec.ts"));
}

function readOrEmpty(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function testTitles(testsFolder: string): string[] {
  const titles: string[] = [];
  for (const name of specNames(testsFolder)) {
    const source = readFileSync(join(testsFolder, name), "utf8");
    for (const match of source.matchAll(/\btest\(\s*(["'`])(.+?)\1/g)) titles.push(match[2]);
  }
  return titles;
}

const countExpects = (source: string) => (source.match(/\bexpect(\.soft|\.poll)?\(/g) ?? []).length;

// ---------- stage 1: the guard on every changed test file ----------

function unifiedDiff(oldFile: string, newFile: string): string {
  const empty = join(tmpdir(), "gate-empty-file");
  writeFileSync(empty, "");
  const before = existsSync(oldFile) ? oldFile : empty;
  const after = existsSync(newFile) ? newFile : empty;
  const result = Bun.spawnSync(["diff", "-u", before, after]);
  return result.stdout.toString();
}

function guardStage(pullTests: string, numbers: Numbers): Stage {
  const mainTests = join(HERE, "tests");
  const names = new Set([...specNames(mainTests), ...specNames(pullTests)]);
  let removed = 0;
  let firstReason = "";
  for (const name of names) {
    const oldFile = join(mainTests, name);
    const newFile = join(pullTests, name);
    const lost = countExpects(readOrEmpty(oldFile)) - countExpects(readOrEmpty(newFile));
    removed += Math.max(0, lost);
    const reason = reasonToReject(unifiedDiff(oldFile, newFile));
    if (reason && !firstReason) firstReason = `${name}: ${reason}`;
  }
  numbers["assertions removed"] = removed;
  if (firstReason) return { name: "guard", passed: false, says: firstReason };
  return { name: "guard", passed: true, says: "no test checks less than before" };
}

// ---------- stage 2: the mutation score ----------

type Mutant = { status: string };
type MutationReport = { files: Record<string, { mutants: Mutant[] }> };

function mutationScore(reportPath: string): number {
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as MutationReport;
  const mutants = Object.values(report.files).flatMap((file) => file.mutants);
  const detected = mutants.filter((mutant) => ["Killed", "Timeout"].includes(mutant.status));
  const counted = mutants.filter((mutant) =>
    ["Killed", "Timeout", "Survived", "NoCoverage"].includes(mutant.status),
  );
  if (counted.length === 0) return 0;
  return Math.round((detected.length / counted.length) * 100);
}

function mutationStage(pullFolder: string, numbers: Numbers): Stage {
  const reportPath = join(pullFolder, "reports", "mutation", "mutation.json");
  if (!existsSync(reportPath)) {
    return { name: "mutation", passed: false, says: "the pull request has no mutation report" };
  }
  const config = JSON.parse(readFileSync(join(HERE, "stryker.config.json"), "utf8"));
  const breakAt = Number(config.thresholds?.break ?? 100);
  const score = mutationScore(reportPath);
  numbers["mutation score"] = score;
  const says = `mutation score ${score} (break at ${breakAt})`;
  return { name: "mutation", passed: score >= breakAt, says };
}

// ---------- stages 3 to 5: running tests on a private shop ----------

type Shop = { url: string; stop: () => void };

async function startShop(bugs: string): Promise<Shop> {
  const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const port = listener.port;
  listener.stop(true);
  const dataFolder = mkdtempSync(join(tmpdir(), "gate-shop-"));
  // biome-ignore lint/style/useNamingConvention: environment variable names are uppercase
  const environment = { ...process.env, PORT: String(port), BUGS: bugs, PANTRY_DATA: dataFolder };
  const root = courseRoot();
  const server = Bun.spawn(["bun", join(root, "world", "server.ts")], {
    cwd: root,
    env: environment,
    stdout: "ignore",
    stderr: "ignore",
  });
  const url = `http://localhost:${port}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    const healthy = await fetch(`${url}/health`).then(
      (response) => response.ok,
      () => false,
    );
    if (healthy) break;
    await Bun.sleep(100);
  }
  const stop = () => {
    server.kill();
    rmSync(dataFolder, { recursive: true, force: true });
  };
  return { url, stop };
}

type TestRun = { failed: number; ran: number };

// Runs the tests on a fresh shop with these bugs on, and counts what failed.
async function runTests(testsFolder: string, bugs: string, extraArgs: string[]): Promise<TestRun> {
  const shop = await startShop(bugs);
  const reportPath = join(mkdtempSync(join(tmpdir(), "gate-report-")), "report.json");
  // biome-ignore-start lint/style/useNamingConvention: environment variable names are uppercase
  const environment = {
    ...process.env,
    TESTS_DIR: testsFolder,
    BASE_URL: shop.url,
    PW_JSON: reportPath,
    CI: "1",
  };
  // biome-ignore-end lint/style/useNamingConvention: environment variable names are uppercase
  const command = ["bun", "x", "playwright", "test", "--config", "playwright.config.ts"];
  const child = Bun.spawn([...command, ...extraArgs], {
    cwd: HERE,
    env: environment,
    stdout: "ignore",
    stderr: "ignore",
  });
  await child.exited;
  shop.stop();
  const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) : {};
  const stats = report.stats ?? {};
  const failed = (stats.unexpected ?? 0) + (stats.flaky ?? 0);
  return { failed, ran: failed + (stats.expected ?? 0) };
}

const escapeForGrep = (title: string) => title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const grepFor = (titles: string[]) => ["--grep", titles.map(escapeForGrep).join("|")];

async function suiteStage(pullTests: string): Promise<Stage> {
  const run = await runTests(pullTests, "none", []);
  const passed = run.ran > 0 && run.failed === 0;
  const says = `${run.ran - run.failed} of ${run.ran} tests pass on the fixed build`;
  return { name: "suite", passed, says };
}

async function steadyStage(pullTests: string, newTitles: string[], numbers: Numbers) {
  numbers["flaky failures"] = 0;
  if (newTitles.length === 0) return { name: "steady", passed: true, says: "no new tests" };
  const repeat = `--repeat-each=${STEADY_RUNS}`;
  const run = await runTests(pullTests, "none", [repeat, ...grepFor(newTitles)]);
  numbers["flaky failures"] = run.failed;
  const says = `new tests failed ${run.failed} of ${run.ran} runs on the fixed build`;
  return { name: "steady", passed: run.failed === 0, says };
}

async function bugCaughtBy(pullTests: string, title: string): Promise<string | null> {
  for (const bug of REQUIREMENT_BUGS) {
    const run = await runTests(pullTests, bug, grepFor([title]));
    if (run.failed > 0) return bug;
  }
  return null;
}

async function catchesStage(pullTests: string, newTitles: string[], numbers: Numbers) {
  let catching = 0;
  let idle = "";
  for (const title of newTitles) {
    const bug = await bugCaughtBy(pullTests, title);
    if (bug) catching++;
    else if (!idle) idle = title;
  }
  numbers["new tests that catch a planted bug"] = `${catching} of ${newTitles.length}`;
  if (idle) return { name: "catches", passed: false, says: `"${idle}" catches no planted bug` };
  return { name: "catches", passed: true, says: "every new test catches a planted bug" };
}

// ---------- the gate ----------

async function runStages(pullFolder: string, numbers: Numbers): Promise<Stage[]> {
  const pullTests = join(pullFolder, "tests");
  const mainTitles = new Set(testTitles(join(HERE, "tests")));
  const newTitles = testTitles(pullTests).filter((title) => !mainTitles.has(title));
  const stages: Stage[] = [];
  const steps = [
    async () => guardStage(pullTests, numbers),
    async () => mutationStage(pullFolder, numbers),
    () => suiteStage(pullTests),
    () => steadyStage(pullTests, newTitles, numbers),
    () => catchesStage(pullTests, newTitles, numbers),
  ];
  for (const step of steps) {
    const stage = await step();
    stages.push(stage);
    console.log(`  ${stage.passed ? "PASS   " : "BLOCKED"}  ${stage.name}: ${stage.says}`);
    if (!stage.passed) break;
  }
  return stages;
}

function printNumbers(numbers: Numbers) {
  const parts = Object.entries(numbers).map(([name, value]) => `${name} ${value}`);
  console.log(`Numbers: ${parts.join(", ")}`);
}

async function gate(pullFolder: string, scorecardPath: string | undefined): Promise<number> {
  console.log(`Gate for pull request: ${basename(pullFolder)}`);
  const numbers: Numbers = {};
  const stages = await runStages(pullFolder, numbers);
  printNumbers(numbers);
  if (scorecardPath) writeFileSync(scorecardPath, `${JSON.stringify(numbers, null, 2)}\n`);
  const blocked = stages.find((stage) => !stage.passed);
  if (blocked) {
    console.log(`BLOCKED at ${blocked.name}: ${blocked.says}`);
    return 1;
  }
  console.log("MERGE: every stage passed.");
  return 0;
}

const [pullArgument, flag, scorecardArgument] = process.argv.slice(2);
if (!pullArgument) {
  console.log("Name a pull request folder: bun run gate ../pulls/clean-pull");
  process.exit(1);
}
const scorecard = flag === "--scorecard" ? resolve(scorecardArgument) : undefined;
process.exit(await gate(resolve(pullArgument), scorecard));
