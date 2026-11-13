// generate-tests-from-the-plan: one test per plan scenario, written the way Playwright
// recommends, green on the fixed build.
// The check reads the files and then runs them against a private shop.
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Rule } from "../scripts/verify";
import { norm, readText, scenarios } from "./lib/markdown";
import { once } from "./lib/memo";
import { allTests, CSS_OR_XPATH, specFiles } from "./lib/static";
import { runSuite } from "./lib/suite";
import { withShop } from "./lib/world";

const PLAN_AREAS = ["slots", "basket"];

// The seed was written by hand in an earlier step, so it does not count as generated.
const isNotTheSeed = (file: string) => basename(file) !== "seed.spec.ts";

const generatedFiles = (folder: string) => specFiles(join(folder, "tests")).filter(isNotTheSeed);

const generatedTests = (folder: string) =>
  allTests(join(folder, "tests")).filter((testCase) => isNotTheSeed(testCase.file));

const textOf = (file: string) => readFileSync(file, "utf8");

const scenariosInPlan = (folder: string, area: string) =>
  scenarios(readText(join(folder, "specs", `${area}.md`)));

function planTitles(folder: string): string[] {
  const allScenarios = PLAN_AREAS.flatMap((area) => scenariosInPlan(folder, area));
  return allScenarios.map((scenario) => norm(scenario.title));
}

function planNamedInFile(file: string): string | undefined {
  const specComment = textOf(file).match(/^\/\/\s*spec:\s*(\S+)/m);
  return specComment?.[1];
}

function namesAnExistingPlan(folder: string, file: string): boolean {
  const plan = planNamedInFile(file);
  return Boolean(plan && existsSync(join(folder, plan)));
}

// Every generated file must pass the given test, and there must be at least one file.
function everyGeneratedFile(folder: string, passes: (file: string) => boolean): boolean {
  const files = generatedFiles(folder);
  return files.length > 0 && files.every(passes);
}

function everyPlanTitleHasTest(folder: string): boolean {
  const testTitles = generatedTests(folder).map((testCase) => norm(testCase.title));
  const haveTitles = new Set(testTitles);
  const wantTitles = planTitles(folder);
  return wantTitles.length > 0 && wantTitles.every((title) => haveTitles.has(title));
}

function everyTestHasAnExpect(folder: string): boolean {
  const tests = generatedTests(folder);
  return tests.length > 0 && tests.every((testCase) => testCase.expects > 0);
}

const runOnFixedShop = (folder: string) =>
  once("generate", folder, () =>
    withShop({ bugs: "none" }, (shop) => runSuite(join(folder, "tests"), shop.url)),
  );

async function everyTestPasses(folder: string): Promise<boolean> {
  const suite = await runOnFixedShop(folder);
  return suite.ran && suite.failed === 0 && suite.passed === suite.tests.length;
}

export default [
  {
    says: "tests/ has generated spec files next to the seed",
    test: (folder) => generatedFiles(folder).length > 0,
    tryNext: "run the generator on specs/slots.md and specs/basket.md and save its files in tests/",
  },
  {
    says: "each generated file names its plan in a // spec: line, and that plan exists",
    test: (folder) => everyGeneratedFile(folder, (file) => namesAnExistingPlan(folder, file)),
    tryNext:
      "start each file with a line like // spec: specs/slots.md, as the Playwright generator does",
  },
  {
    says: "every plan scenario has a test with the same title",
    test: everyPlanTitleHasTest,
    tryNext:
      "give each test the exact title of its scenario, " +
      "so a reviewer can trace a red test back to the plan",
  },
  {
    says: "every test has at least one expect",
    test: everyTestHasAnExpect,
    tryNext:
      "add an expect for what the scenario's Expected part says; " +
      "a test with no expect checks nothing",
  },
  {
    says: "no test waits with waitForTimeout",
    test: (folder) => everyGeneratedFile(folder, (file) => !/waitForTimeout\(/.test(textOf(file))),
    tryNext: "replace each waitForTimeout with an expect that waits for what the shopper would see",
  },
  {
    says: "no test finds elements by CSS or XPath",
    test: (folder) => everyGeneratedFile(folder, (file) => !CSS_OR_XPATH.test(textOf(file))),
    tryNext:
      'use getByRole, getByLabel, getByText or getByTestId instead of locator("#id") or XPath',
  },
  {
    says: "every test passes on the fixed build",
    test: everyTestPasses,
    tryNext:
      "run bunx playwright test in this folder with the shop on BUGS=none and fix each red test",
  },
] satisfies Rule[];
