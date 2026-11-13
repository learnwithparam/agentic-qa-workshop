// bun run check: the repo standard. CI runs this; any failure stops the build.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { allSteps, type Part, parts, ROOT, type Step } from "./structure";

const errors: string[] = [];

function fail(where: string, what: string) {
  errors.push(`${relative(ROOT, where) || "."}: ${what}`);
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const STEP_SECTIONS = [
  "## The problem",
  "## Your challenge",
  "## Done when",
  "## If you get stuck",
  "## Words you will use",
];
const HYPE = new RegExp(
  "\\b(supercharge|unleash|unlock|seamless(ly)?|leverage|dive into|game[- ]changer" +
    "|revolutioni[sz]e|magic(al)?|cutting[- ]edge|AI-powered)\\b",
  "i",
);
const TIME_WORDS = /\b(week|day|hour)\s+\d+\b/i;
const VERB_THING = /^[a-z]+(-[a-z0-9]+)+$/;
const IMAGE = /!\[[^\]]*\]\(([^)\s]+)\)/g;
const MERMAID = /```mermaid\n/;
const MODEL_ID = /\b(claude-[a-z0-9-]+-\d|gpt-\d[\w.-]*|gemini-\d[\w.-]*|o\d-(mini|pro)\b)/i;
const SOLUTION_HAS_NO_PROMPTS =
  "solution/ has no prompts.md: write the prompts that got there, " +
  "the plan Claude Code showed, and what the learner checked";

// Every file in the repo, except installed packages and git's own folder.
function allFiles(folder: string, found: string[] = []): string[] {
  for (const entry of readdirSync(folder)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const path = join(folder, entry);
    if (statSync(path).isDirectory()) allFiles(path, found);
    else found.push(path);
  }
  return found;
}

function hasImage(text: string): boolean {
  return [...text.matchAll(IMAGE)].length > 0;
}

// 1. No Makefile anywhere.
function checkNoMakefile(files: string[]) {
  for (const file of files) {
    if (/(^|\/)(GNU)?[Mm]akefile$/.test(file)) {
      fail(file, "a Makefile is not allowed; use a Bun or uv script");
    }
  }
}

// 2. Prose rules on every Markdown file.
function checkProseLine(file: string, line: string, lineNumber: number) {
  if (line.includes("—")) fail(file, `line ${lineNumber}: em dash`);
  const hypeWord = line.match(HYPE);
  if (hypeWord) fail(file, `line ${lineNumber}: hype word "${hypeWord[0]}"`);
  const timeWord = line.match(TIME_WORDS);
  if (timeWord && !file.includes("schedules")) {
    fail(file, `line ${lineNumber}: "${timeWord[0]}"; content is in parts, schedules map time`);
  }
  if (/\bM=\d+|verify \d+/.test(line)) {
    fail(file, `line ${lineNumber}: numeric step command; name the step`);
  }
}

function checkProse(markdownFiles: string[]) {
  for (const file of markdownFiles) {
    const lines = read(file).split("\n");
    lines.forEach((line, index) => {
      checkProseLine(file, line, index + 1);
    });
  }
}

// 2b. Every page shows, not only tells: images it names exist, and the key pages carry a picture.
function checkImagesExist(markdownFiles: string[]) {
  for (const file of markdownFiles) {
    for (const match of read(file).matchAll(IMAGE)) {
      const imagePath = match[1];
      if (/^https?:/.test(imagePath)) continue;
      if (!existsSync(join(dirname(file), imagePath))) {
        fail(file, `image "${imagePath}" does not exist`);
      }
    }
  }
}

type PictureNeeds = { what: string; mermaid: boolean; image: boolean };

function needPicture(file: string, needs: PictureNeeds) {
  if (!existsSync(file)) return fail(file, "missing");
  const text = read(file);
  if (needs.mermaid && !MERMAID.test(text)) fail(file, `${needs.what} needs a Mermaid diagram`);
  if (needs.image && !hasImage(text)) fail(file, `${needs.what} needs a screenshot`);
}

function checkKeyPagesHavePictures() {
  needPicture(join(ROOT, "README.md"), { what: "the root README", mermaid: true, image: true });
  needPicture(join(ROOT, "00-orientation", "README.md"), {
    what: "the orientation",
    mermaid: false,
    image: true,
  });
}

// 3. Parts and steps.
function checkPartReadme(part: Part) {
  const readme = join(part.dir, "README.md");
  if (!existsSync(readme)) {
    fail(part.dir, "part has no README.md");
    return;
  }
  const text = read(readme);
  if (!MERMAID.test(text)) fail(readme, "part README needs a Mermaid diagram");
  const walkthrough = text.split("## Walkthrough")[1]?.split("\n## ")[0];
  if (walkthrough === undefined) {
    fail(readme, `part README needs a "## Walkthrough" section`);
  } else if (!walkthrough.includes("```bash")) {
    fail(readme, "the walkthrough needs the commands, each with an Expect: line");
  }
}

function checkStepNameAndSize(step: Step, seenNames: Set<string>) {
  if (!VERB_THING.test(step.name)) {
    fail(step.dir, `step name "${step.name}" must be verb-thing in lower case`);
  }
  if (seenNames.has(step.name)) fail(step.dir, `step name "${step.name}" is used twice`);
  seenNames.add(step.name);
  if (!existsSync(join(step.dir, "step.toml"))) fail(step.dir, "missing step.toml");
  const minutes = step.meta.minutes;
  if (minutes < 5 || minutes > 30) {
    fail(step.dir, `step is ${minutes} min; keep a step between 5 and 30, split it if longer`);
  }
}

function checkStepReadme(step: Step, readme: string) {
  const text = read(readme);
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words > 600) fail(readme, `${words} words; a step README stays under 600, split the step`);
  for (const section of STEP_SECTIONS) {
    if (!text.includes(section)) fail(readme, `missing section "${section}"`);
  }
  if (!MERMAID.test(text) && !hasImage(text)) {
    fail(readme, "a step shows a picture: a screenshot or a Mermaid diagram");
  }
  const doneWhen = text.split("## Done when")[1]?.split("\n## ")[0] ?? "";
  if (!/^- /m.test(doneWhen)) fail(readme, "Done when needs at least one bullet");
  if (step.meta.screen) checkScreenStep(step, readme, text);
}

function checkScreenStep(step: Step, readme: string, text: string) {
  const expectedImage = join(step.dir, "images", "expected.png");
  if (!existsSync(expectedImage)) fail(step.dir, "screen step needs images/expected.png");
  if (!text.includes("images/expected.png")) {
    fail(readme, "screen step must show ../images/expected.png");
  }
}

function checkStepSolutionAndCheck(step: Step) {
  const solution = join(step.dir, "solution");
  if (step.meta.solution && !existsSync(solution)) {
    fail(step.dir, "step.toml says solution but there is no solution/");
  }
  if (existsSync(solution) && !existsSync(join(solution, "prompts.md"))) {
    fail(step.dir, SOLUTION_HAS_NO_PROMPTS);
  }
  const hasTypeScriptCheck = existsSync(join(ROOT, "checks", `${step.name}.ts`));
  const hasPythonCheck = existsSync(join(ROOT, "checks", `${step.name}.py`));
  if (!hasTypeScriptCheck && !hasPythonCheck) {
    fail(step.dir, `no check at checks/${step.name}.ts`);
  }
}

function checkStep(step: Step, seenNames: Set<string>) {
  checkStepNameAndSize(step, seenNames);
  const readme = join(step.dir, "problem", "README.md");
  if (!existsSync(readme)) {
    fail(step.dir, "missing problem/README.md");
    return;
  }
  checkStepReadme(step, readme);
  checkStepSolutionAndCheck(step);
}

function checkPartsAndSteps(allParts: Part[]) {
  const seenNames = new Set<string>();
  if (allParts.length === 0) fail(join(ROOT, "parts"), "no parts");
  for (const part of allParts) {
    checkPartReadme(part);
    const readme = join(part.dir, "README.md");
    const skeleton = existsSync(readme) && read(readme).includes("TODO(part session)");
    if (part.steps.length === 0 && !skeleton) fail(part.dir, "part has no steps");
    for (const step of part.steps) checkStep(step, seenNames);
  }
}

// 4. Commands: the README runs the finished system first,
// and every command block says what to expect.
function checkRootReadmeRunsFirst() {
  const rootReadme = join(ROOT, "README.md");
  if (!existsSync(rootReadme)) {
    fail(ROOT, "missing README.md");
    return;
  }
  const text = read(rootReadme);
  const firstCode = text.indexOf("```bash");
  const firstConcept = text.search(/^## (How it works|Concepts|Background|Why)/m);
  if (firstCode < 0) {
    fail(rootReadme, "the README needs a bash block that runs the finished system");
  } else if (firstConcept >= 0 && firstConcept < firstCode) {
    fail(rootReadme, "run the finished system before any concept section");
  }
}

function checkBashBlocksInFile(file: string) {
  const lines = read(file).split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== "```bash") continue;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() !== "```") j++;
    const after = lines.slice(j + 1).find((line) => line.trim() !== "");
    if (!after?.startsWith("Expect:")) {
      fail(file, `line ${i + 1}: a bash block must be followed by an Expect: line`);
    }
    i = j;
  }
}

function checkBashBlocksHaveExpect(markdownFiles: string[]) {
  for (const file of markdownFiles) checkBashBlocksInFile(file);
}

// 5. One model config, exact pins, a troubleshooting table.
function mayNameModels(file: string): boolean {
  return file.includes("/config/models.") || file.includes("/scripts/check.ts");
}

function checkModelIdsInOnePlace(files: string[]) {
  for (const file of files) {
    if (!/\.(ts|py|md|json|toml|ya?ml)$/.test(file) || mayNameModels(file)) continue;
    const modelId = read(file).match(MODEL_ID);
    if (modelId) {
      fail(file, `model id "${modelId[0]}" outside config/models; name models in one place`);
    }
  }
}

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function checkExactPins() {
  const packageFile = join(ROOT, "package.json");
  if (existsSync(packageFile)) {
    const packageJson = JSON.parse(read(packageFile)) as PackageJson;
    const versions = { ...packageJson.dependencies, ...packageJson.devDependencies };
    for (const [name, version] of Object.entries(versions)) {
      if (!/^\d+\.\d+\.\d+$/.test(version)) {
        fail(packageFile, `${name}@${version}: pin an exact version`);
      }
    }
  }
  const pythonProject = join(ROOT, "pyproject.toml");
  if (!existsSync(pythonProject)) return;
  const looseVersion = /"([A-Za-z0-9_.\-[\]]+)\s*(>=|~=|\^|>|<)[^"]*"/g;
  for (const match of read(pythonProject).matchAll(looseVersion)) {
    fail(pythonProject, `${match[1]}: pin with == not ${match[2]}`);
  }
}

function checkTroubleshootingTable() {
  const trouble = join(ROOT, "00-orientation", "troubleshooting.md");
  const tableHeader = /\| *What you see *\| *What it means *\| *Fix *\|/;
  if (!existsSync(trouble) || !tableHeader.test(read(trouble))) {
    const tableNeeded = "a table: What you see | What it means | Fix";
    fail(ROOT, `00-orientation/troubleshooting.md needs ${tableNeeded}`);
  }
}

// 6. Every schedule covers every part, and the minutes add up.
type Session = { parts: string[]; minutes: number };
type Schedules = Record<string, { sessions: Session[] }>;

function minutesPerPart(allParts: Part[]): Record<string, number> {
  const minutes: Record<string, number> = {};
  for (const part of allParts) {
    minutes[part.name] = part.steps.reduce((total, step) => total + step.meta.minutes, 0);
  }
  return minutes;
}

function checkSchedules(allParts: Part[]) {
  const schedulePath = join(ROOT, "schedules.toml");
  if (!existsSync(schedulePath)) {
    fail(ROOT, "missing schedules.toml");
    return;
  }
  const schedules = Bun.TOML.parse(read(schedulePath)) as Schedules;
  const partMinutes = minutesPerPart(allParts);
  for (const [format, schedule] of Object.entries(schedules)) {
    const listed = schedule.sessions.flatMap((session) => session.parts);
    for (const part of allParts) {
      if (!listed.includes(part.name)) {
        fail(schedulePath, `${format} leaves out part "${part.name}"`);
      }
    }
    for (const session of schedule.sessions) {
      checkSessionMinutes({ schedulePath, format, session, partMinutes });
    }
  }
}

type SessionToCheck = {
  schedulePath: string;
  format: string;
  session: Session;
  partMinutes: Record<string, number>;
};

function checkSessionMinutes({ schedulePath, format, session, partMinutes }: SessionToCheck) {
  const need = session.parts.reduce((total, name) => total + (partMinutes[name] ?? 0), 0);
  if (need > session.minutes) {
    fail(schedulePath, `${format}: a session needs ${need} min but has ${session.minutes}`);
  }
}

const files = allFiles(ROOT);
const markdownFiles = files.filter((file) => file.endsWith(".md"));
const allParts = parts();

checkNoMakefile(files);
checkProse(markdownFiles);
checkImagesExist(markdownFiles);
checkKeyPagesHavePictures();
checkPartsAndSteps(allParts);
checkRootReadmeRunsFirst();
checkBashBlocksHaveExpect(markdownFiles);
checkModelIdsInOnePlace(files);
checkExactPins();
checkTroubleshootingTable();
checkSchedules(allParts);

if (errors.length) {
  console.log(`The repo does not meet the standard. ${errors.length} problem(s):`);
  for (const error of errors) console.log(`  - ${error}`);
  process.exit(1);
}
console.log(
  `The repo meets the standard: ${allParts.length} part(s), ${allSteps().length} step(s).`,
);
