// review-the-agent-tests: a verdict for every test the agent wrote, real fixes for the weak ones, and proof
// that the fixes now catch the bugs the weak tests let through.
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Rule } from "../scripts/verify";
import { norm, readText } from "./lib/markdown";
import { allTests, testsIn } from "./lib/static";
import { once } from "./lib/memo";
import { bugKillMatrix } from "./lib/matrix";
import { ROOT } from "../scripts/structure";

const FIXTURE = join(ROOT, "checks", "fixtures", "review-the-agent-tests");
const original = ["slots.spec.ts", "basket.spec.ts"].flatMap((f) => testsIn(join(FIXTURE, f)));
// The three weak tests planted in the agent's output, and the bug each one lets through.
const LET_THROUGH = ["weighted-price", "ghost-line", "promo-stacking"];

type Verdict = { title: string; verdict: "keep" | "fix" | "drop"; why: string };
function verdicts(d: string): Verdict[] {
  return readText(join(d, "qa", "review.md")).split("\n").flatMap((l) => {
    const m = /^\s*[-*]\s+(.+):\s*(keep|fix|drop)\s*(?::\s*(.*))?$/i.exec(l);
    return m ? [{ title: m[1].trim(), verdict: m[2].toLowerCase() as Verdict["verdict"], why: (m[3] ?? "").trim() }] : [];
  });
}
const mine = (d: string) => allTests(join(d, "tests")).filter((t) => basename(t.file) !== "seed.spec.ts");
const squash = (s: string) => s.replace(/\s+/g, "");
const matrix = (d: string) => once("review", d, () => bugKillMatrix(join(d, "tests"), LET_THROUGH, 3));

export default [
  {
    says: "qa/review.md gives every agent test a verdict: keep, fix or drop",
    test: (d) => {
      const v = new Set(verdicts(d).map((x) => norm(x.title)));
      return original.every((t) => v.has(norm(t.title)));
    },
    tryNext: "add one line per test: - <test title>: keep | fix | drop: <why>",
  },
  {
    says: "at least one test is marked fix or drop",
    test: (d) => verdicts(d).some((v) => v.verdict !== "keep"),
    tryNext: "read each test next to its scenario's Expected part; a test that checks a toast is not checking the price",
  },
  {
    says: "every fix and drop says why",
    test: (d) => verdicts(d).filter((v) => v.verdict !== "keep").every((v) => v.why.split(/\s+/).length >= 3),
    tryNext: "after the verdict, say in a few words what the test missed, such as: only checked the toast",
  },
  {
    says: "every test marked fix was changed, and every test marked drop is gone",
    test: (d) => {
      const now = new Map(mine(d).map((t) => [norm(t.title), t]));
      const was = new Map(original.map((t) => [norm(t.title), t]));
      return verdicts(d).every((v) => {
        const k = norm(v.title);
        if (v.verdict === "drop") return !now.has(k);
        if (v.verdict === "fix") return now.has(k) && was.has(k) && squash(now.get(k)!.body) !== squash(was.get(k)!.body);
        return true;
      });
    },
    tryNext: "edit the test you marked fix (or delete the one you marked drop), then run the check again",
  },
  {
    says: "the reviewed suite passes on the fixed build",
    test: async (d) => { const m = await matrix(d); return m.baseline.ran && m.baseline.failed === 0; },
    tryNext: "run bunx playwright test in this folder and fix each red test",
  },
  {
    says: "the reviewed suite now catches weighted-price, ghost-line and promo-stacking",
    test: async (d) => (await matrix(d)).caught === LET_THROUGH.length,
    tryNext: "start the shop with BUGS=weighted-price bun run shop and find the test that should go red; make it check the number the shopper pays",
  },
] satisfies Rule[];
