// Compares a suite with the version it started from, test by test, without running it.
// A test is kept when its title is still there, it has as many expects as before, and every
// matcher with its expected value (like .toHaveText("$1.04")) is still in it.
// The supervisor may move this file to checks/lib/ later.
import { readFileSync } from "node:fs";
import { allTests, type FoundTest, specFiles } from "../../../checks/lib/static";

const MATCHER_START = /(\.not)?\.(to[A-Z]\w*)\s*\(/g;

type Scan = { depth: number; quote: string };

// Reads one character and updates where we are: inside a string, or how deep in brackets.
function step(scan: Scan, character: string): void {
  if (scan.quote) {
    if (character === scan.quote) scan.quote = "";
    return;
  }
  if (character === '"' || character === "'" || character === "`") scan.quote = character;
  if (character === "(") scan.depth += 1;
  if (character === ")") scan.depth -= 1;
}

// Returns the text between the "(" at the given position and the ")" that closes it.
// A backslash in a string skips the next character, so an escaped quote does not end it.
function argumentsFrom(source: string, open: number): string {
  const scan: Scan = { depth: 0, quote: "" };
  for (let i = open; i < source.length; i++) {
    if (scan.quote && source[i] === "\\") {
      i += 1;
      continue;
    }
    step(scan, source[i]);
    if (scan.depth === 0) return source.slice(open + 1, i);
  }
  return source.slice(open + 1);
}

const squeezeSpaces = (text: string) => text.replace(/\s+/g, " ").replace(/,\s*$/, "").trim();

// Every matcher in a test body with its value, such as ".toHaveText("$1.04")".
export function matchersIn(body: string): string[] {
  const found: string[] = [];
  for (const match of body.matchAll(MATCHER_START)) {
    const open = (match.index ?? 0) + match[0].length - 1;
    const values = squeezeSpaces(argumentsFrom(body, open));
    found.push(`${match[1] ?? ""}.${match[2]}(${values})`);
  }
  return found;
}

function keepsEveryMatcher(before: FoundTest, after: FoundTest): boolean {
  const left = matchersIn(after.body);
  for (const matcher of matchersIn(before.body)) {
    const place = left.indexOf(matcher);
    if (place < 0) return false;
    left.splice(place, 1);
  }
  return true;
}

export type Weakened = { title: string; why: string };

function weakeningOf(before: FoundTest, after: FoundTest | undefined): Weakened | null {
  if (!after) return { title: before.title, why: "the test is gone or renamed" };
  if (after.expects < before.expects) return { title: before.title, why: "an expect was removed" };
  if (!keepsEveryMatcher(before, after)) {
    return { title: before.title, why: "an expected value changed" };
  }
  return null;
}

// Lists every starting test that is missing, has fewer expects, or lost a matcher.
export function weakenedTests(startDir: string, nowDir: string): Weakened[] {
  const testsNow = new Map(allTests(nowDir).map((found) => [found.title, found]));
  const weakened: Weakened[] = [];
  for (const before of allTests(startDir)) {
    const problem = weakeningOf(before, testsNow.get(before.title));
    if (problem) weakened.push(problem);
  }
  return weakened;
}

const SKIPPED = /\btest(\.describe)?\.(skip|fixme)\s*\(/;

// True when any test file marks a test skip or fixme.
export function hasSkippedTest(testsDir: string): boolean {
  const files = specFiles(testsDir);
  return files.some((file) => SKIPPED.test(readFileSync(file, "utf8")));
}
