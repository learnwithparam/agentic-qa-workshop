// write-the-seed-test: one test every agent copies. It resets the shop, signs in as Ana, opens an empty basket.
// The check runs it three times against a private shop and reads the shop's event log.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { once } from "./lib/memo";
import { runSuite } from "./lib/suite";
import { withShop } from "./lib/world";
import { testsIn } from "./lib/static";

const file = (d: string) => join(d, "tests", "seed.spec.ts");
const src = (d: string) => (existsSync(file(d)) ? readFileSync(file(d), "utf8") : "");

const run = (d: string) =>
  once("seed", d, () =>
    withShop({ bugs: "none" }, async (shop) => {
      const r = await runSuite(join(d, "tests"), shop.url, { repeatEach: 3 });
      return { r, events: shop.events() };
    }),
  );

export default [
  { says: "tests/seed.spec.ts exists", test: (d) => existsSync(file(d)), tryNext: "keep the seed at tests/seed.spec.ts in this folder" },
  {
    says: "the seed resets the shop through POST /__test/reset",
    test: (d) => /request\.post\(\s*["'`]\/__test\/reset["'`]/.test(src(d)),
    tryNext: "start the test with await request.post(\"/__test/reset\") so every run starts from the seed data",
  },
  {
    says: "the seed has at least one expect",
    test: (d) => existsSync(file(d)) && testsIn(file(d)).some((t) => t.expects > 0),
    tryNext: "end with an expect that proves where you are, such as the empty basket message",
  },
  {
    says: "it passes 3 runs in a row on the fixed build",
    test: async (d) => { const { r } = await run(d); return r.ran && r.tests.length >= 3 && r.failed === 0; },
    tryNext: "run bunx playwright test --repeat-each=3 in this folder and fix the first failure it shows",
  },
  {
    says: "the shop's log shows a reset and a sign-in as Ana on every run",
    test: async (d) => {
      const { events } = await run(d);
      return events.filter((e) => e.type === "reset").length >= 3 && events.filter((e) => e.type === "signed_in" && e.shopper === "ana").length >= 3;
    },
    tryNext: "sign in through the Sign in page with ana@pantryrun.test and password pantry after the reset",
  },
  {
    says: "every run ends on an empty basket page",
    test: async (d) => {
      const { events } = await run(d);
      const views = events.filter((e) => e.type === "basket_viewed");
      return views.length >= 3 && views.every((e) => e.lines === 0) && !events.some((e) => e.type === "basket_add");
    },
    tryNext: "open /basket last and add nothing; the seed is a clean starting point, not a test of adding",
  },
] satisfies Rule[];
