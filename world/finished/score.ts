// Scores what a finished run produced, with the same rules the Part 1 checks use on a
// learner's work.
import { join } from "node:path";
import generateRules from "../../checks/generate-tests-from-the-plan";
import { readText, requirementIds, scenarios } from "../../checks/lib/markdown";
import { allTests } from "../../checks/lib/static";
import planRules from "../../checks/plan-tests-from-requirements";
import { ROOT } from "../../scripts/structure";

type Scored = { says: string; ok: boolean };
type Rule = { says: string; test: (folder: string) => unknown };

const PLANNED_AREAS = ["slots", "basket"];

function scoreRule(rule: Rule, folder: string): Scored {
  return { says: rule.says, ok: Boolean(rule.test(folder)) };
}

function requirementIdsOf(area: string): string[] {
  const requirements = readText(join(ROOT, "world", "requirements", `${area}.md`));
  return requirementIds(requirements);
}

function coveredIdsIn(folder: string): Set<string> {
  const plans = PLANNED_AREAS.map((area) => readText(join(folder, "specs", `${area}.md`)));
  const planScenarios = plans.flatMap((plan) => scenarios(plan));
  return new Set(planScenarios.flatMap((scenario) => scenario.covers));
}

export function scorePlans(folder: string) {
  const wanted = PLANNED_AREAS.flatMap(requirementIdsOf);
  const covered = coveredIdsIn(folder);
  const rules = planRules.map((rule) => scoreRule(rule, folder));
  const coveredCount = wanted.filter((id) => covered.has(id)).length;
  return { rules, covered: coveredCount, total: wanted.length };
}

// The fixed-build run is left to the bug-kill matrix, which runs it anyway.
export function scoreTests(folder: string) {
  const staticRules = generateRules.filter((rule) => !/passes on the fixed build/.test(rule.says));
  const rules = staticRules.map((rule) => scoreRule(rule, folder));
  return { rules, count: allTests(join(folder, "tests")).length };
}
