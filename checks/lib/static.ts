// Reads test files without running them: the tests in a file, their titles and how many expects each has.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type FoundTest = { title: string; body: string; expects: number; file: string };

export function specFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".spec.ts"))
    .map((f) => join(dir, f));
}

// Finds test('title', async (...) => { ... }) blocks and returns each body by matching braces.
export function testsIn(file: string): FoundTest[] {
  const src = readFileSync(file, "utf8");
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
    out.push({
      title: m[2],
      body,
      expects: (body.match(/\bexpect(\.soft|\.poll)?\(/g) ?? []).length,
      file,
    });
  }
  return out;
}

export const allTests = (dir: string) => specFiles(dir).flatMap(testsIn);

// Locators that tie a test to markup instead of what a shopper sees.
export const CSS_OR_XPATH = /\b(locator|\$|\$\$)\(\s*(['"`])\s*(?:xpath=|\/\/|[.#[]|[a-z]+[.#[>])/;
