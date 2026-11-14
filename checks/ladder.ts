// bun checks/ladder.ts: reads ladder.toml and checks every mapped Claude Code feature.
// It fails when a feature's step is missing, has no check, or never shows the feature.
// Features listed under [[todo]] have no step yet. They are printed so nobody forgets them.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { allSteps, ROOT, type Step } from "../scripts/structure";

type Feature = { level: string; name: string; step: string; shows: string };
type Todo = { level: string; names: string[] };
type Ladder = { feature?: Feature[]; todo?: Todo[] };

const TEXT_FILE = /\.(md|json|yml|yaml|toml|ts)$/;

function textUnder(folder: string): string {
  if (!existsSync(folder)) return "";
  const parts: string[] = [];
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    if (name === "node_modules") continue;
    if (statSync(path).isDirectory()) parts.push(textUnder(path));
    else if (TEXT_FILE.test(name)) parts.push(readFileSync(path, "utf8"));
  }
  return parts.join("\n");
}

function stepText(step: Step): string {
  return `${textUnder(join(step.dir, "problem"))}\n${textUnder(join(step.dir, "solution"))}`;
}

export function ladderProblems(): { problems: string[]; todo: string[] } {
  const ladder = Bun.TOML.parse(readFileSync(join(ROOT, "ladder.toml"), "utf8")) as Ladder;
  const steps = allSteps();
  const problems: string[] = [];
  for (const feature of ladder.feature ?? []) {
    const label = `${feature.level} ${feature.name}`;
    const step = steps.find((candidate) => candidate.name === feature.step);
    if (!step) {
      problems.push(`${label}: there is no step called ${feature.step}`);
      continue;
    }
    if (!existsSync(join(ROOT, "checks", `${step.name}.ts`))) {
      problems.push(`${label}: ${step.name} has no check`);
    }
    if (!new RegExp(feature.shows, "i").test(stepText(step))) {
      problems.push(`${label}: ${step.name} never shows "${feature.shows}"`);
    }
  }
  const todo = (ladder.todo ?? []).flatMap((entry) =>
    entry.names.map((name) => `${entry.level} ${name}`),
  );
  return { problems, todo };
}

if (import.meta.main) {
  const { problems, todo } = ladderProblems();
  for (const problem of problems) console.log(`  ${problem}`);
  if (todo.length) console.log(`No step yet for: ${todo.join(", ")}`);
  if (problems.length) {
    console.log(`${problems.length} ladder problem(s).`);
    process.exit(1);
  }
  console.log("Every mapped ladder feature has a step with a check that shows it.");
}
