// plan-tests-from-requirements: test plans for slots and basket
// that cover every written requirement.
// It checks completeness and shape, never the wording: a plan is a judgment.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../scripts/structure";
import type { Rule } from "../scripts/verify";
import { readText, requirementIds, type Scenario, scenarios } from "./lib/markdown";

const requirementsFor = (area: string) =>
  requirementIds(readText(join(ROOT, "world", "requirements", `${area}.md`)));

const ALL_REQUIREMENT_IDS = [
  ...requirementsFor("slots"),
  ...requirementsFor("basket"),
  ...requirementsFor("substitutions"),
];
const PLAN_AREAS = ["slots", "basket"];
const SCENARIO_KINDS = ["happy", "boundary", "negative"];

const planFile = (folder: string, area: string) => join(folder, "specs", `${area}.md`);

const scenariosInPlan = (folder: string, area: string) =>
  scenarios(readText(planFile(folder, area)));

const allScenarios = (folder: string) =>
  PLAN_AREAS.flatMap((area) => scenariosInPlan(folder, area));

const coveredIds = (folder: string) =>
  new Set(allScenarios(folder).flatMap((scenario) => scenario.covers));

// Every scenario must pass the given test, and there must be at least one scenario.
function everyScenario(folder: string, passes: (scenario: Scenario) => boolean): boolean {
  const found = allScenarios(folder);
  return found.length > 0 && found.every(passes);
}

function planExistsWithScenarios(folder: string, area: string): boolean {
  return existsSync(planFile(folder, area)) && scenariosInPlan(folder, area).length > 0;
}

function coversRealRequirements(scenario: Scenario): boolean {
  const covers = scenario.covers;
  return covers.length > 0 && covers.every((id) => ALL_REQUIREMENT_IDS.includes(id));
}

function hasStepsAndExpectedResult(scenario: Scenario): boolean {
  const hasNumberedSteps = /^\s*1\.\s+\S/m.test(scenario.body);
  return hasNumberedSteps && /expect/i.test(scenario.body);
}

function everyRequirementCovered(folder: string, area: string): boolean {
  const covered = coveredIds(folder);
  return requirementsFor(area).every((id) => covered.has(id));
}

function planHasBoundaryOrNegative(folder: string, area: string): boolean {
  return scenariosInPlan(folder, area).some(
    (scenario) => scenario.kind === "boundary" || scenario.kind === "negative",
  );
}

export default [
  {
    says: "specs/slots.md and specs/basket.md exist with scenarios in them",
    test: (folder) => PLAN_AREAS.every((area) => planExistsWithScenarios(folder, area)),
    tryNext:
      "save one plan per area as specs/slots.md and specs/basket.md, " +
      "each scenario under a heading like #### 1.1 <title>",
  },
  {
    says: "every scenario has a Covers line naming a real requirement ID",
    test: (folder) => everyScenario(folder, coversRealRequirements),
    tryNext:
      "add a line like **Covers:** SLOT-2 under each scenario; IDs are in world/requirements",
  },
  {
    says: "every scenario has a Kind: happy, boundary or negative",
    test: (folder) => everyScenario(folder, (scenario) => SCENARIO_KINDS.includes(scenario.kind)),
    tryNext: "add a line like **Kind:** boundary under each scenario",
  },
  {
    says: "every scenario has numbered steps and an expected result",
    test: (folder) => everyScenario(folder, hasStepsAndExpectedResult),
    tryNext:
      "give each scenario numbered steps (1. 2. 3.) " +
      "and an Expected part that says what the shopper sees",
  },
  {
    says: "every SLOT requirement is covered at least once",
    test: (folder) => everyRequirementCovered(folder, "slots"),
    tryNext:
      "compare the Covers lines with world/requirements/slots.md " +
      "and add a scenario for each ID that is missing",
  },
  {
    says: "every BASK requirement is covered at least once",
    test: (folder) => everyRequirementCovered(folder, "basket"),
    tryNext:
      "compare the Covers lines with world/requirements/basket.md " +
      "and add a scenario for each ID that is missing",
  },
  {
    says: "each plan has at least one boundary or negative scenario",
    test: (folder) => PLAN_AREAS.every((area) => planHasBoundaryOrNegative(folder, area)),
    tryNext:
      "ask where each rule flips: the 20th order in a slot, " +
      "21:59 against 22:00, $24.99 against $25.00",
  },
] satisfies Rule[];
