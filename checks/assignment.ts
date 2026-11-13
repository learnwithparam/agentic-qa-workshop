// bun run assignment [folder]    check the closing-part assignment, write assignment/result.json
// bun run assignment --prove     CI: pass on the reference solution, fail on the starter
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../scripts/structure";
import rules, { playwrightVersion } from "./redo-the-flow-with-agents";

const STEP = join(
  ROOT,
  "parts",
  "06-do-it-with-the-tools-teams-run",
  "01-redo-the-flow-with-agents",
);

type Line = { line: string; result: "pass" | "fail" };

async function grade(folder: string): Promise<Line[]> {
  const lines: Line[] = [];
  for (const rule of rules) {
    let ok = false;
    try {
      ok = await rule.test(folder);
    } catch {
      ok = false;
    }
    lines.push({ line: rule.says, result: ok ? "pass" : "fail" });
    if (!ok) console.log(`  FAIL  ${rule.says}\n        Try next: ${rule.tryNext}`);
  }
  return lines;
}

const allPass = (lines: Line[]) => lines.every((line) => line.result === "pass");

async function prove(): Promise<number> {
  const solution = await grade(join(STEP, "solution"));
  const starter = await grade(join(STEP, "problem"));
  console.log(`Reference solution: ${allPass(solution) ? "pass" : "FAIL"}`);
  const starterWord = allPass(starter) ? "PASSES, so it checks nothing" : "fail, as it should";
  console.log(`Untouched starter: ${starterWord}`);
  return allPass(solution) && !allPass(starter) ? 0 : 1;
}

async function main(): Promise<number> {
  if (process.argv[2] === "--prove") return prove();
  const folder = process.argv[2] ?? join(STEP, "problem");
  const lines = await grade(folder);
  const report = { playwrightVersion: playwrightVersion(), lines };
  writeFileSync(join(ROOT, "assignment", "result.json"), `${JSON.stringify(report, null, 2)}\n`);
  for (const line of lines) if (line.result === "pass") console.log(`  PASS  ${line.line}`);
  console.log(
    allPass(lines) ? "Done. All Done-when lines pass." : "Not done yet. See the FAIL lines above.",
  );
  return allPass(lines) ? 0 : 1;
}

process.exit(await main());
