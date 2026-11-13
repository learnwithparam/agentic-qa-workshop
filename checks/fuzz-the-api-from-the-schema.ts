// fuzz-the-api-from-the-schema: a seeded fuzz test that sends many generated orders to the
// partner API and fails on any answer the contract does not list. The check counts the orders
// it really sent, runs it twice to see that the same seed sends the same orders, and switches
// on api-status, where a full slot answers 500.
import { join } from "node:path";
import { openDoor } from "../parts/05-run-it-as-a-team/helpers/traffic";
import type { Rule } from "../scripts/verify";
import { once } from "./lib/memo";
import { hasSpecs, runSuite } from "./lib/suite";
import { withShop } from "./lib/world";

const FEWEST_ORDERS = 100;
const FEWEST_DIFFERENT_ORDERS = 50;

type FuzzRun = { ran: boolean; green: boolean; orders: string[] };

const fuzzTests = (folder: string) => join(folder, "tests", "fuzz");

function runFuzz(folder: string, bugs: string): Promise<FuzzRun> {
  return withShop({ bugs }, async (shop) => {
    const door = openDoor(shop);
    try {
      const suite = await runSuite(fuzzTests(folder), door.url);
      const orderCalls = door.exchanges.filter(
        (call) => call.method === "POST" && call.path === "/api/orders",
      );
      const orders = orderCalls.map((call) => call.body);
      return { ran: suite.ran, green: suite.ran && suite.failed === 0, orders };
    } finally {
      door.close();
    }
  });
}

const firstFixedRun = (folder: string) =>
  once("fuzz-fixed-1", folder, () => runFuzz(folder, "none"));
const secondFixedRun = (folder: string) =>
  once("fuzz-fixed-2", folder, () => runFuzz(folder, "none"));
const statusBugRun = (folder: string) =>
  once("fuzz-api-status", folder, () => runFuzz(folder, "api-status"));

async function sendsManyDifferentOrders(folder: string): Promise<boolean> {
  const { orders } = await firstFixedRun(folder);
  const different = new Set(orders).size;
  console.log(`        Sent ${orders.length} orders, ${different} of them different`);
  return orders.length >= FEWEST_ORDERS && different >= FEWEST_DIFFERENT_ORDERS;
}

async function sameSeedSameOrders(folder: string): Promise<boolean> {
  const first = await firstFixedRun(folder);
  const second = await secondFixedRun(folder);
  const sameLength = first.orders.length === second.orders.length;
  const sameOrders = first.orders.every((order, index) => order === second.orders[index]);
  return first.orders.length > 0 && sameLength && sameOrders;
}

async function goesRedOnTheStatusBug(folder: string): Promise<boolean> {
  const run = await statusBugRun(folder);
  return run.ran && !run.green;
}

export default [
  {
    says: "tests/fuzz/ has a fuzz test",
    test: (folder) => hasSpecs(fuzzTests(folder)),
    tryNext: "ask Claude Code for tests/fuzz/orders.spec.ts, as the README says",
  },
  {
    says: "the fuzz test sends at least 100 orders, and at least 50 of them are different",
    test: sendsManyDifferentOrders,
    tryNext: "generate the orders in a loop from the contract's OrderIn schema, not by hand",
  },
  {
    says: "the fuzz test passes on the fixed build: every answer is one the contract lists",
    test: async (folder) => (await firstFixedRun(folder)).green,
    tryNext: "print the order that got an unlisted status, and check it against openapi.yaml",
  },
  {
    says: "the same seed sends the same orders, so a failure can be replayed",
    test: sameSeedSameOrders,
    tryNext: "replace Math.random with a small random generator that starts from a fixed seed",
  },
  {
    says: "the fuzz test goes red when a full slot answers 500 (api-status)",
    test: goesRedOnTheStatusBug,
    tryNext: "pick slot ids from GET /api/slots, so some orders land on a full slot",
  },
] satisfies Rule[];
