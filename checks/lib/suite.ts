// Runs a folder of Playwright tests against one shop and returns what passed and failed.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "../../scripts/structure";
import { browserEnv } from "./browser";

export type TestResult = {
  title: string;
  file: string;
  status: "passed" | "failed" | "skipped" | "flaky";
  error?: string;
};
export type SuiteResult = {
  ran: boolean;
  exitCode: number;
  tests: TestResult[];
  passed: number;
  failed: number;
  output: string;
};

type SuiteOptions = { repeatEach?: number; grep?: string; args?: string[] };

// The parts of Playwright's JSON report that we read.
type ReportRun = { status: string; error?: { message?: string } };
type ReportTest = { status: string; results?: ReportRun[] };
type ReportSpec = { title: string; file?: string; tests?: ReportTest[] };
type ReportSuite = { file?: string; specs?: ReportSpec[]; suites?: ReportSuite[] };

export function hasSpecs(testsDir: string): boolean {
  if (!existsSync(testsDir)) return false;
  const names = readdirSync(testsDir, { recursive: true });
  return names.some((name) => String(name).endsWith(".spec.ts"));
}

function playwrightArgs(options: SuiteOptions): string[] {
  const config = join(ROOT, "checks", "lib", "playwright.config.ts");
  const args = ["x", "playwright", "test", "--config", config];
  if (options.repeatEach) args.push(`--repeat-each=${options.repeatEach}`);
  if (options.grep) args.push("--grep", options.grep);
  args.push(...(options.args ?? []));
  return args;
}

function statusOf(test: ReportTest, failedRun: ReportRun | undefined): TestResult["status"] {
  if (test.status === "skipped") return "skipped";
  if (test.status === "flaky") return "flaky";
  if (failedRun) return "failed";
  return "passed";
}

function resultsOfSpec(spec: ReportSpec, file: string): TestResult[] {
  const results: TestResult[] = [];
  for (const test of spec.tests ?? []) {
    const runs = test.results ?? [];
    const failedRun = runs.find((run) => run.status !== "passed" && run.status !== "skipped");
    const firstErrorLine = failedRun?.error?.message?.split("\n")[0];
    results.push({
      title: spec.title,
      file: spec.file ?? file,
      status: statusOf(test, failedRun),
      error: firstErrorLine,
    });
  }
  return results;
}

// Suites can hold more suites, so this walks the whole tree and collects every test.
function resultsOfSuite(suite: ReportSuite, file: string): TestResult[] {
  const results: TestResult[] = [];
  for (const spec of suite.specs ?? []) results.push(...resultsOfSpec(spec, file));
  for (const child of suite.suites ?? []) {
    results.push(...resultsOfSuite(child, child.file ?? file));
  }
  return results;
}

function readReport(reportPath: string): TestResult[] {
  if (!existsSync(reportPath)) return [];
  const report: { suites?: ReportSuite[] } = JSON.parse(readFileSync(reportPath, "utf8"));
  const results: TestResult[] = [];
  for (const suite of report.suites ?? []) {
    results.push(...resultsOfSuite(suite, suite.file as string));
  }
  return results;
}

async function runPlaywright(args: string[], environment: Record<string, string>) {
  const child = Bun.spawn(["bun", ...args], {
    cwd: ROOT,
    env: { ...process.env, ...browserEnv(), ...environment },
    stdout: "pipe",
    stderr: "pipe",
  });
  const standardOutput = await new Response(child.stdout).text();
  const standardError = await new Response(child.stderr).text();
  const exitCode = await child.exited;
  return { output: standardOutput + standardError, exitCode };
}

export async function runSuite(
  testsDir: string,
  baseUrl: string,
  options: SuiteOptions = {},
): Promise<SuiteResult> {
  if (!hasSpecs(testsDir)) {
    return {
      ran: false,
      exitCode: 1,
      tests: [],
      passed: 0,
      failed: 0,
      output: "no .spec.ts files",
    };
  }
  const work = mkdtempSync(join(tmpdir(), "pw-"));
  const reportPath = join(work, "report.json");
  // The config in checks/lib reads these to find the tests, the shop and where to write.
  // biome-ignore-start lint/style/useNamingConvention: environment variable names are uppercase
  const environment = {
    TESTS_DIR: testsDir,
    BASE_URL: baseUrl,
    PW_JSON: reportPath,
    PW_OUT: join(work, "out"),
    CI: "1",
  };
  // biome-ignore-end lint/style/useNamingConvention: environment variable names are uppercase
  const { output, exitCode } = await runPlaywright(playwrightArgs(options), environment);
  const tests = readReport(reportPath);
  rmSync(work, { recursive: true, force: true });
  const passed = tests.filter((test) => test.status === "passed").length;
  const failedTests = tests.filter((test) => test.status === "failed" || test.status === "flaky");
  return { ran: tests.length > 0, exitCode, tests, passed, failed: failedTests.length, output };
}
