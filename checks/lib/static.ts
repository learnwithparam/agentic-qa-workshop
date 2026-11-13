// Reads test files without running them: the tests in a file, their titles and how many expects each has.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type FoundTest = { title: string; body: string; expects: number; file: string };

export function specFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith(".spec.ts")).map((f) => join(dir, f));
}

// The body of the block that opens at src[open], found by matching braces.
function block(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  return src.slice(open);
}

const EXPECT = /\bexpect(\.soft|\.poll)?\(/g;

// Helpers in the same file that assert, such as `async function expectTotals(page, want) { await expect(...) }`.
// A test that calls one checks something, even with no expect of its own.
export function assertingHelpers(src: string): string[] {
  const names: string[] = [];
  const re = /(?:\bfunction\s+([A-Za-z_$][\w$]*)\s*\(|\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const open = src.indexOf("{", re.lastIndex);
    if (open < 0) continue;
    const body = block(src, open);
    if (EXPECT.test(body)) names.push(m[1] ?? m[2]);
    EXPECT.lastIndex = 0;
  }
  return names;
}

// Finds test('title', async (...) => { ... }) blocks and returns each body by matching braces.
// expects counts expect calls plus calls to asserting helpers in the same file.
export function testsIn(file: string): FoundTest[] {
  const src = readFileSync(file, "utf8");
  const helpers = assertingHelpers(src);
  const out: FoundTest[] = [];
  const re = /\btest(?:\.only)?\(\s*(['"`])((?:\\.|(?!\1).)*)\1\s*,/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const arrow = src.indexOf("=>", re.lastIndex);
    const open = arrow < 0 ? -1 : src.indexOf("{", arrow);
    if (open < 0) break;
    let depth = 0;
    let i = open;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}" && --depth === 0) break;
    }
    const body = src.slice(open, i + 1);
    const own = (body.match(EXPECT) ?? []).length;
    const viaHelpers = helpers.reduce((n, h) => n + (body.match(new RegExp(`\\b${h.replace(/\$/g, "\\$")}\\(`, "g")) ?? []).length, 0);
    out.push({ title: m[2], body, expects: own + viaHelpers, file });
  }
  return out;
}

export const allTests = (dir: string) => specFiles(dir).flatMap(testsIn);

// Locators that tie a test to markup instead of what a shopper sees.
export const CSS_OR_XPATH = /\b(locator|\$|\$\$)\(\s*(['"`])\s*(?:xpath=|\/\/|[.#\[]|[a-z]+[.#\[>])/;
