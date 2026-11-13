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

// Finds test('title', async (...) => { ... }) blocks and returns each body by matching braces.
export function testsIn(file: string): FoundTest[] {
  const source = readFileSync(file, "utf8");
  const found: FoundTest[] = [];
  const testStart = new RegExp(TEST_START);
  for (let match = testStart.exec(source); match; match = testStart.exec(source)) {
    const open = bodyStart(source, testStart.lastIndex);
    if (open < 0) break;
    const body = source.slice(open, closingBrace(source, open) + 1);
    const expects = (body.match(EXPECT_CALL) ?? []).length;
    found.push({ title: match[2], body, expects, file });
  }
  return found;
}

export const allTests = (dir: string) => specFiles(dir).flatMap(testsIn);

// Locators that tie a test to markup instead of what a shopper sees.
export const CSS_OR_XPATH = /\b(locator|\$|\$\$)\(\s*(['"`])\s*(?:xpath=|\/\/|[.#[]|[a-z]+[.#[>])/;
