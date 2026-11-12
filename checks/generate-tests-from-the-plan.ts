// generate-tests-from-the-plan: one test per plan scenario, written the way Playwright recommends, green
// on the fixed build. The check reads the files and then runs them against a private shop.
import { existsSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import type { Rule } from "../scripts/verify";
import { norm, readText, scenarios } from "./lib/markdown";
import { CSS_OR_XPATH, allTests, specFiles } from "./lib/static";
import { once } from "./lib/memo";
import { runSuite } from "./lib/suite";
import { withShop } from "./lib/world";

const generated = (d: string) => specFiles(join(d, "tests")).filter((f) => basename(f) !== "seed.spec.ts");
const tests = (d: string) => allTests(join(d, "tests")).filter((t) => basename(t.file) !== "seed.spec.ts");
const planTitles = (d: string) => ["slots", "basket"].flatMap((f) => scenarios(readText(join(d, "specs", `${f}.md`)))).map((s) => norm(s.title));
const specLine = (f: string) => readFileSync(f, "utf8").match(/^\/\/\s*spec:\s*(\S+)/m)?.[1];
const run = (d: string) => once("generate", d, () => withShop({ bugs: "none" }, (s) => runSuite(join(d, "tests"), s.url)));

export default [
  {
    says: "tests/ has generated spec files next to the seed",
    test: (d) => generated(d).length > 0,
    tryNext: "run the generator on specs/slots.md and specs/basket.md and save its files in tests/",
  },
  {
    says: "each generated file names its plan in a // spec: line, and that plan exists",
    test: (d) => generated(d).length > 0 && generated(d).every((f) => { const s = specLine(f); return Boolean(s && existsSync(join(d, s))); }),
    tryNext: "start each file with a line like // spec: specs/slots.md, as the Playwright generator does",
  },
  {
    says: "every plan scenario has a test with the same title",
    test: (d) => {
      const have = new Set(tests(d).map((t) => norm(t.title)));
      const want = planTitles(d);
      return want.length > 0 && want.every((t) => have.has(t));
    },
    tryNext: "give each test the exact title of its scenario, so a reviewer can trace a red test back to the plan",
  },
  {
    says: "every test has at least one expect",
    test: (d) => tests(d).length > 0 && tests(d).every((t) => t.expects > 0),
    tryNext: "add an expect for what the scenario's Expected part says; a test with no expect checks nothing",
  },
  {
    says: "no test waits with waitForTimeout",
    test: (d) => generated(d).length > 0 && generated(d).every((f) => !/waitForTimeout\(/.test(readFileSync(f, "utf8"))),
    tryNext: "replace each waitForTimeout with an expect that waits for what the shopper would see",
  },
  {
    says: "no test finds elements by CSS or XPath",
    test: (d) => generated(d).length > 0 && generated(d).every((f) => !CSS_OR_XPATH.test(readFileSync(f, "utf8"))),
    tryNext: "use getByRole, getByLabel, getByText or getByTestId instead of locator(\"#id\") or XPath",
  },
  {
    says: "every test passes on the fixed build",
    test: async (d) => { const r = await run(d); return r.ran && r.failed === 0 && r.passed === r.tests.length; },
    tryNext: "run bunx playwright test in this folder with the shop on BUGS=none and fix each red test",
  },
] satisfies Rule[];
