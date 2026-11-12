// Scores what a finished run produced, with the same rules the Part 1 checks use on a learner's work.
import { join } from "node:path";
import generateRules from "../../checks/generate-tests-from-the-plan";
import { readText, requirementIds, scenarios } from "../../checks/lib/markdown";
import { allTests } from "../../checks/lib/static";
import planRules from "../../checks/plan-tests-from-requirements";
import { ROOT } from "../../scripts/structure";

type Scored = { says: string; ok: boolean };

export function scorePlans(dir: string) {
  const want = ["slots", "basket"].flatMap((f) =>
    requirementIds(readText(join(ROOT, "world", "requirements", `${f}.md`))),
  );
  const have = new Set(
    ["slots", "basket"]
      .flatMap((f) => scenarios(readText(join(dir, "specs", `${f}.md`))))
      .flatMap((s) => s.covers),
  );
  const rules: Scored[] = planRules.map((r) => ({ says: r.says, ok: Boolean(r.test(dir)) }));
  return { rules, covered: want.filter((id) => have.has(id)).length, total: want.length };
}

// The fixed-build run is left to the bug-kill matrix, which runs it anyway.
export function scoreTests(dir: string) {
  const rules: Scored[] = generateRules
    .filter((r) => !/passes on the fixed build/.test(r.says))
    .map((r) => ({ says: r.says, ok: Boolean(r.test(dir)) }));
  return { rules, count: allTests(join(dir, "tests")).length };
}
