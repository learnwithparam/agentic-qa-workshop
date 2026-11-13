// Reads test files without running them.
// It finds the tests in a file, their titles and how many expects each one has.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type FoundTest = { title: string; body: string; expects: number; file: string };

export function specFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const names = readdirSync(dir, { recursive: true }).map(String);
  const specNames = names.filter((name) => name.endsWith(".spec.ts"));
  return specNames.map((name) => join(dir, name));
}

// Finds the start of a test: test('title', or test.only("title", with any quote mark.
const TEST_START = /\btest(?:\.only)?\(\s*(['"`])((?:\\.|(?!\1).)*)\1\s*,/g;

const EXPECT_CALL = /\bexpect(\.soft|\.poll)?\(/g;

// Returns the position of the "}" that closes the "{" at the given position.
// If the braces never close, it returns the end of the source.
function closingBrace(source: string, open: number): number {
  let depth = 0;
  let i = open;
  for (; i < source.length; i++) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return i;
}

// Returns the position of the "{" that opens the test function after "from", or -1.
function bodyStart(source: string, from: number): number {
  const arrow = source.indexOf("=>", from);
  if (arrow < 0) return -1;
  return source.indexOf("{", arrow);
}

// Finds a helper's name: "function expectTotals(" or "const expectTotals = async (page) =>".
const NAME = "([A-Za-z_$][\\w$]*)";
const FUNCTION_HELPER = `\\bfunction\\s+${NAME}\\s*\\(`;
const ARROW_PARAMS = "(?:async\\s*)?(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)";
const ARROW_HELPER = `\\b(?:const|let)\\s+${NAME}\\s*=\\s*${ARROW_PARAMS}\\s*=>`;
const HELPER_START = new RegExp(`(?:${FUNCTION_HELPER}|${ARROW_HELPER})`, "g");

// Returns the names of helpers in this source that call expect.
// Claude Code often puts the checks for a total or a message in a helper such as expectTotals.
export function assertingHelpers(source: string): string[] {
  const names: string[] = [];
  const helperStart = new RegExp(HELPER_START);
  for (let match = helperStart.exec(source); match; match = helperStart.exec(source)) {
    const open = source.indexOf("{", helperStart.lastIndex);
    if (open < 0) continue;
    const body = source.slice(open, closingBrace(source, open) + 1);
    if (new RegExp(EXPECT_CALL).test(body)) names.push(match[1] ?? match[2]);
  }
  return names;
}

// Counts how many times the body calls one of the asserting helpers.
function helperCalls(body: string, helpers: string[]): number {
  let calls = 0;
  for (const name of helpers) {
    const call = new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\(`, "g");
    calls += (body.match(call) ?? []).length;
  }
  return calls;
}

// Finds test('title', async (...) => { ... }) blocks and returns each body by matching braces.
// A call to an asserting helper counts as an expect, because the test checks something through it.
export function testsIn(file: string): FoundTest[] {
  const source = readFileSync(file, "utf8");
  const helpers = assertingHelpers(source);
  const found: FoundTest[] = [];
  const testStart = new RegExp(TEST_START);
  for (let match = testStart.exec(source); match; match = testStart.exec(source)) {
    const open = bodyStart(source, testStart.lastIndex);
    if (open < 0) break;
    const body = source.slice(open, closingBrace(source, open) + 1);
    const expects = (body.match(EXPECT_CALL) ?? []).length + helperCalls(body, helpers);
    found.push({ title: match[2], body, expects, file });
  }
  return found;
}

export const allTests = (dir: string) => specFiles(dir).flatMap(testsIn);

// Locators that tie a test to markup instead of what a shopper sees.
export const CSS_OR_XPATH = /\b(locator|\$|\$\$)\(\s*(['"`])\s*(?:xpath=|\/\/|[.#[]|[a-z]+[.#[>])/;
