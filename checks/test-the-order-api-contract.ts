// test-the-order-api-contract: API tests that hold the shop to world/openapi.yaml.
// The check runs the tests through a recording door, so it sees every call they really make.
// Then it switches on the two API bugs, one at a time, and the tests must go red.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { openDoor, pathPattern } from "../parts/04-test-beyond-the-ui/helpers/traffic";
import { ROOT } from "../scripts/structure";
import type { Rule } from "../scripts/verify";
import { once } from "./lib/memo";
import { specFiles } from "./lib/static";
import { runSuite, type SuiteResult } from "./lib/suite";
import { withShop } from "./lib/world";

const CONTRACT = join(ROOT, "world", "openapi.yaml");

type Operation = { method: string; path: string; statuses: string[] };
type OpenApi = { paths: Record<string, Record<string, { responses: Record<string, unknown> }>> };

function contractOperations(): Operation[] {
  const contract = Bun.YAML.parse(readFileSync(CONTRACT, "utf8")) as OpenApi;
  const operations: Operation[] = [];
  for (const [path, methods] of Object.entries(contract.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const statuses = Object.keys(operation.responses);
      operations.push({ method: method.toUpperCase(), path, statuses });
    }
  }
  return operations;
}

const apiTests = (folder: string) => join(folder, "tests", "api");

type Covered = { suite: SuiteResult; seen: Set<string> };

// One "METHOD /path STATUS" line per call, with the path written as the contract writes it.
function contractLine(method: string, realPath: string, status: number): string | null {
  for (const operation of contractOperations()) {
    const samePath = pathPattern(operation.path).test(realPath);
    if (samePath && operation.method === method) return `${method} ${operation.path} ${status}`;
  }
  return null;
}

function runOnFixedBuild(folder: string): Promise<Covered> {
  return once("contract-fixed", folder, () =>
    withShop({ bugs: "none" }, async (shop) => {
      const door = openDoor(shop);
      try {
        const suite = await runSuite(apiTests(folder), door.url);
        const lines = door.exchanges.map((call) =>
          contractLine(call.method, call.path, call.status),
        );
        const seen = new Set(lines.filter((line): line is string => line !== null));
        return { suite, seen };
      } finally {
        door.close();
      }
    }),
  );
}

function missingFromContract(seen: Set<string>): string[] {
  const missing: string[] = [];
  for (const operation of contractOperations()) {
    for (const status of operation.statuses) {
      const line = `${operation.method} ${operation.path} ${status}`;
      if (!seen.has(line)) missing.push(line);
    }
  }
  return missing;
}

async function coversTheWholeContract(folder: string): Promise<boolean> {
  const { seen } = await runOnFixedBuild(folder);
  const missing = missingFromContract(seen);
  if (missing.length > 0) console.log(`        Not reached yet: ${missing.join(", ")}`);
  return missing.length === 0;
}

async function passesOnFixedBuild(folder: string): Promise<boolean> {
  const { suite } = await runOnFixedBuild(folder);
  return suite.ran && suite.failed === 0;
}

function goesRedWith(bug: string) {
  return (folder: string) =>
    once(`contract-${bug}`, folder, async () => {
      const suite = await withShop({ bugs: bug }, (shop) =>
        runSuite(apiTests(folder), shop.url, { args: ["--max-failures=1"] }),
      );
      return suite.ran && suite.failed > 0;
    });
}

function namesTheContract(folder: string): boolean {
  const files = specFiles(apiTests(folder));
  const namesIt = (file: string) =>
    /^\/\/\s*spec:.*openapi\.yaml/m.test(readFileSync(file, "utf8"));
  return files.length > 0 && files.every(namesIt);
}

function usesOnlyTheRequestFixture(folder: string): boolean {
  const files = specFiles(apiTests(folder));
  const opensBrowserPage = (file: string) => /\bpage\./.test(readFileSync(file, "utf8"));
  return files.length > 0 && !files.some(opensBrowserPage);
}

export default [
  {
    says: "tests/api/ has spec files, and each names the contract in a // spec: line",
    test: (folder) => existsSync(apiTests(folder)) && namesTheContract(folder),
    tryNext: "ask Claude Code to start each file with // spec: world/openapi.yaml",
  },
  {
    says: "the API tests call the API with the request fixture, never a page",
    test: usesOnlyTheRequestFixture,
    tryNext: "ask Claude Code to use the request fixture: request.get and request.post",
  },
  {
    says: "the API tests pass on the fixed build",
    test: passesOnFixedBuild,
    tryNext: "run bunx playwright test tests/api in this folder and fix each red test",
  },
  {
    says: "the API tests reach every path and every status code in openapi.yaml",
    test: coversTheWholeContract,
    tryNext: "read the Not reached yet list, and ask Claude Code for one test per missing status",
  },
  {
    says: "the API tests go red when the order says slot_id instead of slotId (api-field-rename)",
    test: goesRedWith("api-field-rename"),
    tryNext: "check every order body against a strict schema made from the Order in openapi.yaml",
  },
  {
    says: "the API tests go red when a full slot answers 500 instead of 409 (api-status)",
    test: goesRedWith("api-status"),
    tryNext: "add a test that orders into the full 18:00 slot and expects exactly 409 slot_full",
  },
] satisfies Rule[];
