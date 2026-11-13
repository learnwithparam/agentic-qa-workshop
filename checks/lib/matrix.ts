// The bug-kill matrix: run one suite once per planted bug.
// A bug is caught when the suite fails with it on.
// The suite must also pass on the fixed build, or a failure proves nothing.
import { BUGS } from "../../world/bugs";
import { runSuite, type SuiteResult } from "./suite";
import { withShop } from "./world";

export type Row = { bug: string; breaks: string; caught: boolean; failing: string[] };
export type Matrix = { baseline: SuiteResult; rows: Row[]; caught: number };

// Several rules in one check ask for the same matrix, so each one is computed only once.
const memo = new Map<string, Promise<Matrix>>();

export function bugKillMatrix(
  testsDir: string,
  bugIds: string[],
  concurrency = 4,
): Promise<Matrix> {
  const key = `${testsDir}|${bugIds.join(",")}`;
  let matrix = memo.get(key);
  if (!matrix) {
    matrix = compute(testsDir, bugIds, concurrency);
    memo.set(key, matrix);
  }
  return matrix;
}

async function rowForBug(testsDir: string, bugId: string): Promise<Row> {
  // One failing test is enough to count a bug as caught, so stop at the first failure.
  const result = await withShop({ bugs: bugId }, (shop) =>
    runSuite(testsDir, shop.url, { args: ["--max-failures=1"] }),
  );
  const failedTests = result.tests.filter(
    (test) => test.status === "failed" || test.status === "flaky",
  );
  const failing = failedTests.map((test) => test.title);
  const bug = BUGS.find((plantedBug) => plantedBug.id === bugId);
  return {
    bug: bugId,
    breaks: bug?.breaks ?? "",
    caught: result.ran && failing.length > 0,
    failing,
  };
}

async function compute(testsDir: string, bugIds: string[], concurrency: number): Promise<Matrix> {
  const baseline = await withShop({ bugs: "none" }, (shop) => runSuite(testsDir, shop.url));
  const rows: Row[] = new Array(bugIds.length);
  let next = 0;
  // Each worker takes the next bug that nobody has started yet, until none are left.
  const worker = async () => {
    while (next < bugIds.length) {
      const i = next;
      next += 1;
      rows[i] = await rowForBug(testsDir, bugIds[i]);
    }
  };
  const workerCount = Math.min(concurrency, bugIds.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  const caught = rows.filter((row) => row.caught).length;
  return { baseline, rows, caught };
}

export function printMatrix(matrix: Matrix, log = console.log) {
  const { baseline } = matrix;
  const allGreen = baseline.ran && baseline.failed === 0;
  const warning = allGreen ? "" : "  <- must be all green";
  log(`  fixed build (BUGS=none): ${baseline.passed} passed, ${baseline.failed} failed${warning}`);
  for (const row of matrix.rows) {
    const verdict = row.caught ? "CAUGHT" : "missed";
    log(`  ${verdict}  ${row.bug.padEnd(20)} ${row.breaks}`);
  }
  log(`  ${matrix.caught} of ${matrix.rows.length} bugs caught`);
}
