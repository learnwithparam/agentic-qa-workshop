// bun run board                  the goal board for the finished suite in reference/tests
// bun run board <tests-folder>   the same board for any folder of Playwright tests
// It starts the shop once per planted bug, runs the suite, and counts the bugs the suite caught.
import { existsSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { bugKillMatrix } from "../checks/lib/matrix";
import { hasSpecs } from "../checks/lib/suite";
import { ROOT } from "../scripts/structure";
import { BUGS } from "./bugs";

type Matrix = Awaited<ReturnType<typeof bugKillMatrix>>;
type MatrixRow = Matrix["rows"][number];

function testsFolder(argument: string | undefined): string {
  if (!argument) {
    return join(ROOT, "reference", "tests");
  }
  if (isAbsolute(argument)) {
    return argument;
  }
  return join(process.cwd(), argument);
}

function groupOf(bugId: string): string | undefined {
  const bug = BUGS.find((planted) => planted.id === bugId);
  return bug?.group;
}

function groupLine(label: string, rows: MatrixRow[]): string {
  const caughtCount = rows.filter((row) => row.caught).length;
  const marks = rows.map((row) => `${row.caught ? "+" : "-"}${row.bug}`);
  return `  ${label.padEnd(18)} ${caughtCount} of ${rows.length}   ${marks.join(" ")}`;
}

const argument = process.argv[2];
const folder = testsFolder(argument);
const name = argument ? relative(ROOT, folder) : "Reference suite";
if (!existsSync(folder) || !hasSpecs(folder)) {
  const shownFolder = relative(ROOT, folder) || folder;
  console.log(
    `No .spec.ts files in ${shownFolder}. Your board: 0 of ${BUGS.length} planted bugs caught.`,
  );
  process.exit(1);
}
console.log(
  `Running ${name} once on the fixed build and once per planted bug (${BUGS.length} runs)...`,
);
const matrix = await bugKillMatrix(
  folder,
  BUGS.map((bug) => bug.id),
);
const baseline = matrix.baseline;
const green = baseline.ran && baseline.failed === 0;
const buildState = green ? "green" : "RED";
console.log("");
console.log("  GOAL BOARD");
console.log(
  `  fixed build      ${buildState}: ${baseline.passed} passed, ${baseline.failed} failed`,
);
const groups: [string, string][] = [
  ["requirement", "requirement bugs"],
  ["looks", "looks and access"],
  ["api", "API contract"],
  ["unwritten", "found by exploring"],
  ["ai", "AI suggester"],
];
for (const [group, label] of groups) {
  const rows = matrix.rows.filter((row) => groupOf(row.bug) === group);
  console.log(groupLine(label, rows));
}
console.log("");
const verdict = green
  ? `${matrix.caught} of ${BUGS.length} planted bugs caught, fixed build green`
  : "fixed build is red, so no catch counts";
console.log(`${name}: ${verdict}.`);
process.exit(green && matrix.caught === BUGS.length ? 0 : 1);
