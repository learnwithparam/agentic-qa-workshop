// redo-the-flow-with-agents: plan, generate and heal one flow with Playwright's agents.
// The check never calls a model. It reads the files the agents left behind and runs them.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../scripts/structure";
import type { Rule } from "../scripts/verify";
import { scenarios } from "./lib/markdown";
import { once } from "./lib/memo";
import { allTests } from "./lib/static";
import { runSuite } from "./lib/suite";
import { withShop } from "./lib/world";

const EXPECTED_VERSION = "1.65.0";
const FLOW = "book-a-slot";

export function playwrightVersion(): string {
  const file = join(ROOT, "node_modules", "@playwright", "test", "package.json");
  if (!existsSync(file)) return "not installed";
  return JSON.parse(readFileSync(file, "utf8")).version;
}

const planPath = (folder: string) => join(folder, "specs", `${FLOW}.md`);
const specPath = (folder: string) => join(folder, "tests", `${FLOW}.spec.ts`);
const brokenFolder = (folder: string) => join(folder, "qa", "healing", "broken");

function planHasScenarios(folder: string): boolean {
  if (!existsSync(planPath(folder))) return false;
  return scenarios(readFileSync(planPath(folder), "utf8")).length >= 3;
}

const runOnFixedShop = (name: string, folder: string, testsDir: string) =>
  once(name, folder, () => withShop({ bugs: "none" }, (shop) => runSuite(testsDir, shop.url)));

function expectCount(file: string): number {
  const tests = allTests(join(file, ".."));
  return tests.reduce((total, test) => total + test.expects, 0);
}

async function generatedSpecPasses(folder: string): Promise<boolean> {
  if (!existsSync(specPath(folder)) || !planHasScenarios(folder)) return false;
  const namesPlan = /^\/\/\s*spec:\s*specs\/book-a-slot\.md/m.test(
    readFileSync(specPath(folder), "utf8"),
  );
  if (!namesPlan) return false;
  const tests = join(folder, "tests");
  const suite = await runOnFixedShop("redo-generated", folder, tests);
  return suite.ran && suite.failed === 0 && suite.tests.length > 1;
}

async function healedSpecPasses(folder: string): Promise<boolean> {
  const broken = join(brokenFolder(folder), `${FLOW}.spec.ts`);
  if (!existsSync(broken) || !existsSync(specPath(folder))) return false;
  const brokenRun = await runOnFixedShop("redo-broken", folder, brokenFolder(folder));
  const healedRun = await runOnFixedShop("redo-healed", folder, join(folder, "tests"));
  const breakWasReal = brokenRun.ran && brokenRun.failed > 0;
  const healedPasses = healedRun.ran && healedRun.failed === 0;
  const changed = readFileSync(broken, "utf8") !== readFileSync(specPath(folder), "utf8");
  const keptAssertions = expectCount(specPath(folder)) >= expectCount(broken);
  return breakWasReal && healedPasses && changed && keptAssertions;
}

export default [
  {
    says: `@playwright/test resolves to ${EXPECTED_VERSION}`,
    test: () => playwrightVersion() === EXPECTED_VERSION,
    tryNext: `run bun install so node_modules holds @playwright/test ${EXPECTED_VERSION}`,
  },
  {
    says: "a plan file with at least 3 scenarios exists for the chosen flow",
    test: planHasScenarios,
    tryNext: "ask the planner agent for specs/book-a-slot.md and keep its #### scenario headings",
  },
  {
    says: "the generated spec names its plan and passes on the fixed build",
    test: generatedSpecPasses,
    tryNext: "ask the generator agent for tests/book-a-slot.spec.ts, then run bunx playwright test",
  },
  {
    says: "after the scripted selector break, the healed spec passes with no assertion lost",
    test: healedSpecPasses,
    tryNext:
      "run the break-selector script, then ask the healer agent to fix tests/book-a-slot.spec.ts",
  },
] satisfies Rule[];
