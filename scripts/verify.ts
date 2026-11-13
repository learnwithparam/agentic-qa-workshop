// bun run verify <step-name>          check your work on one step, then show progress on every step
// bun run verify <step-name> solution check the sample solution instead
// bun run verify part <part-name>     check every step in one part (a deliverable)
// bun run verify --report             write verify-report.json for cohort grading
// bun run verify --all                CI: each check fails on its starter and wrong answers,
//                                     and passes on its solution
// Exit codes: 0 pass, 1 fail, 2 the check could not run.

import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { allSteps, findStep, type Part, parts, ROOT, type Step } from "./structure";

export type Rule = {
  says: string;
  test: (dir: string) => boolean | Promise<boolean>;
  tryNext: string;
};
type Result = {
  step: string;
  status: "pass" | "fail" | "error";
  passed: number;
  total: number;
  failed: string[];
};

async function rulesFor(step: Step): Promise<Rule[]> {
  const checkModule = await import(join(ROOT, "checks", `${step.name}.ts`));
  return checkModule.default;
}

// A rule that throws counts as a failed rule, never as a crash.
async function rulePasses(rule: Rule, dir: string): Promise<boolean> {
  try {
    return await rule.test(dir);
  } catch {
    return false;
  }
}

// Some checks print a grid as they run. When we only count passes (Progress, --all),
// we hide that grid, so the learner never sees another step's output under their own.
async function quietly<T>(work: () => Promise<T>): Promise<T> {
  const log = console.log;
  console.log = () => {};
  try {
    return await work();
  } finally {
    console.log = log;
  }
}

function checkRule(rule: Rule, dir: string, print: boolean): Promise<boolean> {
  if (print) return rulePasses(rule, dir);
  return quietly(() => rulePasses(rule, dir));
}

function printRule(rule: Rule, ok: boolean) {
  if (ok) {
    console.log(`  PASS  ${rule.says}`);
  } else {
    console.log(`  FAIL  ${rule.says}\n        Try next: ${rule.tryNext}`);
  }
}

async function run(step: Step, dir: string, print = false): Promise<Result> {
  let rules: Rule[];
  try {
    rules = await rulesFor(step);
  } catch (error) {
    if (print) {
      const reason = (error as Error).message;
      console.log(`  ERROR  the check for ${step.name} could not load: ${reason}`);
    }
    return { step: step.name, status: "error", passed: 0, total: 0, failed: [] };
  }
  const failed: string[] = [];
  for (const rule of rules) {
    const ok = await checkRule(rule, dir, print);
    if (!ok) failed.push(rule.says);
    if (print) printRule(rule, ok);
  }
  return {
    step: step.name,
    status: failed.length ? "fail" : "pass",
    passed: rules.length - failed.length,
    total: rules.length,
    failed,
  };
}

function work(step: Step): string {
  return join(step.dir, "problem");
}

function wrongAnswers(step: Step): { name: string; dir: string }[] {
  const wrongFolder = join(step.dir, "wrong");
  if (!existsSync(wrongFolder)) return [];
  return readdirSync(wrongFolder).map((name) => ({ name, dir: join(wrongFolder, name) }));
}

function countPassing(results: Result[]): number {
  return results.filter((result) => result.status === "pass").length;
}

async function solutionProblems(step: Step): Promise<string[]> {
  if (!existsSync(join(step.dir, "solution"))) {
    return [`${step.name}: needs solution/ so CI can prove the check can pass`];
  }
  const solution = await run(step, join(step.dir, "solution"));
  if (solution.status === "pass") return [];
  return [`${step.name}: the sample solution fails: ${solution.failed.join("; ")}`];
}

async function wrongAnswerProblems(step: Step): Promise<string[]> {
  const wrong = wrongAnswers(step);
  const problems: string[] = [];
  if (wrong.length === 0) {
    problems.push(
      `${step.name}: needs at least one wrong/<mistake>/ answer that the check must reject`,
    );
  }
  for (const answer of wrong) {
    const result = await run(step, answer.dir);
    if (result.status === "pass") {
      problems.push(`${step.name}: wrong answer "${answer.name}" passes the check`);
    }
  }
  return problems;
}

async function checkProblems(step: Step): Promise<string[]> {
  let rules: Rule[] = [];
  try {
    rules = await rulesFor(step);
  } catch (error) {
    return [`${step.name}: the check could not load: ${(error as Error).message}`];
  }
  const problems: string[] = [];
  for (const rule of rules) {
    const words = rule.tryNext.trim().split(/\s+/);
    if (words.length < 3)
      problems.push(`${step.name}: rule "${rule.says}" needs a try-next sentence`);
  }
  const starter = await run(step, work(step));
  if (starter.status === "pass") {
    problems.push(`${step.name}: the check passes on the starter, so it checks nothing`);
  }
  problems.push(...(await solutionProblems(step)));
  problems.push(...(await wrongAnswerProblems(step)));
  return problems;
}

async function verifyAll() {
  const bad: string[] = [];
  for (const step of allSteps()) bad.push(...(await checkProblems(step)));
  for (const problem of bad) console.log(`  ${problem}`);
  if (bad.length) {
    console.log(`${bad.length} check problem(s).`);
  } else {
    console.log("Every check rejects its starter and wrong answers, and passes its solution.");
  }
  process.exit(bad.length ? 1 : 0);
}

async function writeReport() {
  const results: Result[] = [];
  for (const step of allSteps()) results.push(await run(step, work(step)));
  const reportPath = join(ROOT, "verify-report.json");
  const report = { version: 1, at: new Date().toISOString(), results };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  const passing = countPassing(results);
  console.log(`Wrote verify-report.json: ${passing} of ${results.length} steps pass.`);
  process.exit(0);
}

function partExitCode(results: Result[], done: number): number {
  if (results.some((result) => result.status === "error")) return 2;
  if (done === results.length) return 0;
  return 1;
}

function findPartOrExit(partName: string | undefined): Part {
  const part = parts().find((candidate) => candidate.name === partName);
  if (part) return part;
  if (partName) console.log(`There is no part called "${partName}". Parts:`);
  else console.log("Name a part. Parts:");
  for (const candidate of parts()) console.log(`  bun run verify part ${candidate.name}`);
  process.exit(1);
}

async function verifyPart(partName: string | undefined) {
  const part = findPartOrExit(partName);
  console.log(`Part ${part.name}:`);
  const results: Result[] = [];
  for (const step of part.steps) {
    const result = await run(step, work(step));
    results.push(result);
    const status = result.status.toUpperCase().padEnd(5);
    console.log(`  ${status}  ${step.name}  (${result.passed}/${result.total} rules)`);
  }
  const done = countPassing(results);
  if (done === results.length) {
    console.log(`Part ${part.name} is done: ${done}/${results.length} steps pass.`);
  } else {
    const hint = "Run bun run verify <step-name> on a FAIL line to see why.";
    console.log(`${done}/${results.length} steps pass. ${hint}`);
  }
  process.exit(partExitCode(results, done));
}

function findStepOrExit(stepName: string | undefined): Step {
  const step = stepName ? findStep(stepName) : undefined;
  if (step) return step;
  if (stepName) console.log(`There is no step called "${stepName}". Steps:`);
  else console.log("Name a step. Steps:");
  for (const candidate of allSteps()) console.log(`  bun run verify ${candidate.name}`);
  process.exit(1);
}

async function printProgress() {
  // Done is recomputed from the checks every time, never read from a saved flag.
  console.log("Counting the steps that pass. This runs every check, so it can take a few minutes.");
  const results: Result[] = [];
  for (const step of allSteps()) results.push(await run(step, work(step)));
  console.log(`Progress: ${countPassing(results)}/${results.length} steps pass.`);
}

async function verifyStep(stepName: string | undefined, which: string | undefined) {
  const step = findStepOrExit(stepName);
  const asSolution = which === "solution";
  const whose = asSolution ? "sample solution" : "your work";
  console.log(`Checking ${step.name} (${whose}):`);
  const folder = asSolution ? join(step.dir, "solution") : work(step);
  const result = await run(step, folder, true);
  if (result.status === "error") process.exit(2);
  if (result.status === "pass") {
    console.log(`Done. All ${result.total} rules pass.`);
  } else {
    console.log(
      `${result.passed} of ${result.total} rules pass. Fix the FAIL lines and run it again.`,
    );
  }
  if (!asSolution) await printProgress();
  process.exit(result.status === "pass" ? 0 : 1);
}

const [command, which] = process.argv.slice(2);

if (command === "--all") await verifyAll();
if (command === "--report") await writeReport();
if (command === "part") await verifyPart(which);
await verifyStep(command, which);
