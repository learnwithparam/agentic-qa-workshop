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

export function hasSpecs(testsDir: string): boolean {
  if (!existsSync(testsDir)) return false;
  return readdirSync(testsDir, { recursive: true }).some((f) => String(f).endsWith(".spec.ts"));
}

export async function runSuite(
  testsDir: string,
  baseUrl: string,
  opts: { repeatEach?: number; grep?: string; args?: string[] } = {},
): Promise<SuiteResult> {
  if (!hasSpecs(testsDir))
    return {
      ran: false,
      exitCode: 1,
      tests: [],
      passed: 0,
      failed: 0,
      output: "no .spec.ts files",
    };
  const work = mkdtempSync(join(tmpdir(), "pw-"));
  const json = join(work, "report.json");
  const args = [
    "x",
    "playwright",
    "test",
    "--config",
    join(ROOT, "checks", "lib", "playwright.config.ts"),
  ];
  if (opts.repeatEach) args.push(`--repeat-each=${opts.repeatEach}`);
  if (opts.grep) args.push("--grep", opts.grep);
  args.push(...(opts.args ?? []));
  const proc = Bun.spawn(["bun", ...args], {
    cwd: ROOT,
    env: {
      ...process.env,
      ...browserEnv(),
      TESTS_DIR: testsDir,
      BASE_URL: baseUrl,
      PW_JSON: json,
      PW_OUT: join(work, "out"),
      CI: "1",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const output =
    (await new Response(proc.stdout).text()) + (await new Response(proc.stderr).text());
  const exitCode = await proc.exited;
  const tests: TestResult[] = [];
  if (existsSync(json)) {
    const report = JSON.parse(readFileSync(json, "utf8"));
    const walk = (suite: any, file: string) => {
      for (const spec of suite.specs ?? []) {
        for (const t of spec.tests ?? []) {
          const results = t.results ?? [];
          const failedRun = results.find(
            (r: any) => r.status !== "passed" && r.status !== "skipped",
          );
          const status: TestResult["status"] =
            t.status === "skipped"
              ? "skipped"
              : t.status === "flaky"
                ? "flaky"
                : failedRun
                  ? "failed"
                  : "passed";
          tests.push({
            title: spec.title,
            file: spec.file ?? file,
            status,
            error: failedRun?.error?.message?.split("\n")[0],
          });
        }
      }
      for (const s of suite.suites ?? []) walk(s, s.file ?? file);
    };
    for (const s of report.suites ?? []) walk(s, s.file);
  }
  rmSync(work, { recursive: true, force: true });
  return {
    ran: tests.length > 0,
    exitCode,
    tests,
    passed: tests.filter((t) => t.status === "passed").length,
    failed: tests.filter((t) => t.status === "failed" || t.status === "flaky").length,
    output,
  };
}
