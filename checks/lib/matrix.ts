// The bug-kill matrix: run one suite once per planted bug. A bug is caught when the suite fails with it on.
// The suite must also pass on the fixed build, or a failure proves nothing.
import { BUGS } from "../../world/bugs";
import { runSuite, type SuiteResult } from "./suite";
import { withShop } from "./world";

export type Row = { bug: string; breaks: string; caught: boolean; failing: string[] };
export type Matrix = { baseline: SuiteResult; rows: Row[]; caught: number };

const memo = new Map<string, Promise<Matrix>>();

export function bugKillMatrix(testsDir: string, bugIds: string[], concurrency = 4): Promise<Matrix> {
  const key = `${testsDir}|${bugIds.join(",")}`;
  if (!memo.has(key)) memo.set(key, compute(testsDir, bugIds, concurrency));
  return memo.get(key)!;
}

async function compute(testsDir: string, bugIds: string[], concurrency: number): Promise<Matrix> {
  const baseline = await withShop({ bugs: "none" }, (s) => runSuite(testsDir, s.url));
  const rows: Row[] = new Array(bugIds.length);
  let next = 0;
  const worker = async () => {
    while (next < bugIds.length) {
      const i = next++;
      const id = bugIds[i];
      // One failing test is enough to count a bug as caught, so stop at the first failure.
      const r = await withShop({ bugs: id }, (s) => runSuite(testsDir, s.url, { args: ["--max-failures=1"] }));
      const failing = r.tests.filter((t) => t.status === "failed" || t.status === "flaky").map((t) => t.title);
      rows[i] = { bug: id, breaks: BUGS.find((b) => b.id === id)?.breaks ?? "", caught: r.ran && failing.length > 0, failing };
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, bugIds.length) }, worker));
  return { baseline, rows, caught: rows.filter((r) => r.caught).length };
}

export function printMatrix(m: Matrix, log = console.log) {
  const allGreen = m.baseline.ran && m.baseline.failed === 0;
  log(`  fixed build (BUGS=none): ${m.baseline.passed} passed, ${m.baseline.failed} failed${allGreen ? "" : "  <- must be all green"}`);
  for (const r of m.rows) log(`  ${r.caught ? "CAUGHT" : "missed"}  ${r.bug.padEnd(20)} ${r.breaks}`);
  log(`  ${m.caught} of ${m.rows.length} bugs caught`);
}
