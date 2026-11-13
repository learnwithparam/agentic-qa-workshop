// Reads the repo layout once. Every other script asks this file where things are.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const ROOT = join(import.meta.dir, "..");

export type Step = {
  name: string; // verb-the-thing, also the command argument
  dir: string;
  part: string;
  meta: { minutes: number; screen: boolean; solution: boolean };
};
export type Part = { name: string; dir: string; steps: Step[] };

// What a step.toml may hold. Every field is optional.
type StepToml = { minutes?: number; screen?: boolean; solution?: boolean };

// The folders inside a folder, sorted by name. A missing folder has none.
function foldersIn(folder: string): string[] {
  if (!existsSync(folder)) return [];
  const entries = readdirSync(folder);
  const folders = entries.filter((entry) => statSync(join(folder, entry)).isDirectory());
  return folders.sort();
}

function isStepFolder(folder: string): boolean {
  return existsSync(join(folder, "step.toml"));
}

// Folders keep an order prefix for sorting only. Learners never type it.
export const bareName = (folder: string) => folder.replace(/^\d+-/, "");

function readStep(partFolder: string, partDir: string, stepFolder: string): Step {
  const stepDir = join(partDir, stepFolder);
  const metaPath = join(stepDir, "step.toml");
  let stepToml: StepToml = {};
  if (existsSync(metaPath)) stepToml = Bun.TOML.parse(readFileSync(metaPath, "utf8")) as StepToml;
  return {
    name: bareName(stepFolder),
    dir: stepDir,
    part: bareName(partFolder),
    meta: {
      minutes: Number(stepToml.minutes ?? 0),
      screen: Boolean(stepToml.screen),
      solution: Boolean(stepToml.solution),
    },
  };
}

// The orientation is a part too when 00-orientation holds a step folder (one with a step.toml).
// Part folders with no steps yet are skeletons a later part session fills in.
export function parts(): Part[] {
  const partsRoot = join(ROOT, "parts");
  const orientation = join(ROOT, "00-orientation");
  const orientationFolders = foldersIn(orientation);
  const hasStep = orientationFolders.some((folder) => isStepFolder(join(orientation, folder)));
  const partFolders: { folder: string; dir: string }[] = [];
  if (hasStep) partFolders.push({ folder: "orientation", dir: orientation });
  for (const folder of foldersIn(partsRoot)) {
    partFolders.push({ folder, dir: join(partsRoot, folder) });
  }
  return partFolders.map(({ folder, dir }) => {
    const stepFolders = foldersIn(dir).filter((stepFolder) => isStepFolder(join(dir, stepFolder)));
    const steps = stepFolders.map((stepFolder) => readStep(folder, dir, stepFolder));
    return { name: bareName(folder), dir, steps };
  });
}

export const allSteps = () => parts().flatMap((part) => part.steps);

export function findStep(name: string): Step | undefined {
  return allSteps().find((step) => step.name === name);
}
