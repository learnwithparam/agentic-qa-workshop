// write-the-seed-test: one test every agent copies.
// It resets the shop, signs in as Ana, opens an empty basket.
// The check runs it three times against a private shop and reads the shop's event log.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { once } from "./lib/memo";
import { testsIn } from "./lib/static";
import { runSuite } from "./lib/suite";
import { withShop } from "./lib/world";

// The seed must pass this many runs in a row, so it is not flaky.
const RUNS = 3;

const seedFile = (folder: string) => join(folder, "tests", "seed.spec.ts");

function seedSource(folder: string): string {
  if (!existsSync(seedFile(folder))) return "";
  return readFileSync(seedFile(folder), "utf8");
}

const runOnFixedShop = (folder: string) =>
  once("seed", folder, () =>
    withShop({ bugs: "none" }, async (shop) => {
      const suite = await runSuite(join(folder, "tests"), shop.url, { repeatEach: RUNS });
      return { suite, events: shop.events() };
    }),
  );

type ShopEvent = Awaited<ReturnType<typeof runOnFixedShop>>["events"][number];

const countOf = (events: ShopEvent[], isWanted: (event: ShopEvent) => boolean) =>
  events.filter(isWanted).length;

function seedHasAnExpect(folder: string): boolean {
  if (!existsSync(seedFile(folder))) return false;
  return testsIn(seedFile(folder)).some((testCase) => testCase.expects > 0);
}

async function passesEveryRun(folder: string): Promise<boolean> {
  const { suite } = await runOnFixedShop(folder);
  return suite.ran && suite.tests.length >= RUNS && suite.failed === 0;
}

async function resetsAndSignsInEveryRun(folder: string): Promise<boolean> {
  const { events } = await runOnFixedShop(folder);
  const resets = countOf(events, (event) => event.type === "reset");
  const anaSignIns = countOf(
    events,
    (event) => event.type === "signed_in" && event.shopper === "ana",
  );
  return resets >= RUNS && anaSignIns >= RUNS;
}

async function endsOnEmptyBasketEveryRun(folder: string): Promise<boolean> {
  const { events } = await runOnFixedShop(folder);
  const basketViews = events.filter((event) => event.type === "basket_viewed");
  const everyViewIsEmpty = basketViews.every((event) => event.lines === 0);
  const addedSomething = events.some((event) => event.type === "basket_add");
  return basketViews.length >= RUNS && everyViewIsEmpty && !addedSomething;
}

export default [
  {
    says: "tests/seed.spec.ts exists",
    test: (folder) => existsSync(seedFile(folder)),
    tryNext: "keep the seed at tests/seed.spec.ts in this folder",
  },
  {
    says: "the seed resets the shop through POST /__test/reset",
    test: (folder) => /request\.post\(\s*["'`]\/__test\/reset["'`]/.test(seedSource(folder)),
    tryNext:
      'start the test with await request.post("/__test/reset") ' +
      "so every run starts from the seed data",
  },
  {
    says: "the seed has at least one expect",
    test: seedHasAnExpect,
    tryNext: "end with an expect that proves where you are, such as the empty basket message",
  },
  {
    says: "it passes 3 runs in a row on the fixed build",
    test: passesEveryRun,
    tryNext:
      "run bunx playwright test --repeat-each=3 in this folder and fix the first failure it shows",
  },
  {
    says: "the shop's log shows a reset and a sign-in as Ana on every run",
    test: resetsAndSignsInEveryRun,
    tryNext:
      "sign in through the Sign in page with ana@pantryrun.test and password pantry " +
      "after the reset",
  },
  {
    says: "every run ends on an empty basket page",
    test: endsOnEmptyBasketEveryRun,
    tryNext:
      "open /basket last and add nothing; the seed is a clean starting point, not a test of adding",
  },
] satisfies Rule[];
