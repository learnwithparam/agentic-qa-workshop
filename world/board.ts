// bun run board                  the goal board for the finished suite in reference/tests
// bun run board <tests-folder>   the same board for any folder of Playwright tests
// It starts the shop once per planted bug, runs the suite, and counts the bugs the suite caught.
import { existsSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { BUGS } from "./bugs";
import { bugKillMatrix } from "../checks/lib/matrix";
import { hasSpecs } from "../checks/lib/suite";
import { ROOT } from "../scripts/structure";

const arg = process.argv[2];
const dir = arg ? (isAbsolute(arg) ? arg : join(process.cwd(), arg)) : join(ROOT, "reference", "tests");
const name = arg ? relative(ROOT, dir) : "Reference suite";
if (!existsSync(dir) || !hasSpecs(dir)) {
  console.log(`No .spec.ts files in ${relative(ROOT, dir) || dir}. Your board: 0 of ${BUGS.length} planted bugs caught.`);
  process.exit(1);
}
console.log(`Running ${name} once on the fixed build and once per planted bug (${BUGS.length} runs)...`);
const m = await bugKillMatrix(dir, BUGS.map((b) => b.id));
const green = m.baseline.ran && m.baseline.failed === 0;
console.log("");
console.log("  GOAL BOARD");
console.log(`  fixed build      ${green ? "green" : "RED"}: ${m.baseline.passed} passed, ${m.baseline.failed} failed`);
const groups: [string, string][] = [["requirement", "requirement bugs"], ["looks", "looks and access"], ["api", "API contract"], ["unwritten", "found by exploring"], ["ai", "AI suggester"]];
for (const [g, label] of groups) {
  const rows = m.rows.filter((r) => BUGS.find((b) => b.id === r.bug)!.group === g);
  console.log(`  ${label.padEnd(18)} ${rows.filter((r) => r.caught).length} of ${rows.length}   ${rows.map((r) => `${r.caught ? "+" : "-"}${r.bug}`).join(" ")}`);
}
console.log("");
const verdict = green ? `${m.caught} of ${BUGS.length} planted bugs caught, fixed build green` : `fixed build is red, so no catch counts`;
console.log(`${name}: ${verdict}.`);
process.exit(green && m.caught === BUGS.length ? 0 : 1);
