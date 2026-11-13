// Stops an agent from weakening a Playwright test.
//
// It reads standard input in one of two forms:
//   1. a unified diff, like the output of `git diff`;
//   2. the JSON that Claude Code sends to a PreToolUse hook for an Edit or a Write.
//
// It exits with code 2 and a one-line reason on stderr when a change weakens a test.
// Claude Code shows that reason to the agent and blocks the edit.
// Otherwise it exits with code 0.

import { existsSync, readFileSync } from "node:fs";

// One file's text before and after the change.
// Every check compares these two texts, whatever form the input came in.
interface Change {
  file: string;
  before: string;
  after: string;
}

// The parts of the Claude Code hook payload that the guard needs.
// biome-ignore-start lint/style/useNamingConvention: Claude Code chooses these snake_case names.
interface EditInput {
  old_string?: string;
  new_string?: string;
}

interface ToolInput extends EditInput {
  file_path?: string;
  content?: string;
  edits?: EditInput[];
}

interface HookInput {
  tool_name?: string;
  tool_input?: ToolInput;
}
// biome-ignore-end lint/style/useNamingConvention: Claude Code chooses these snake_case names.

// Playwright's own values for each tolerance setting.
// Adding a setting that was missing is compared against these, so adding `retries: 2` counts
// as raising retries from 0 to 2.
const DEFAULT_TOLERANCES: Record<string, number> = {
  maxDiffPixels: 0,
  maxDiffPixelRatio: 0,
  threshold: 0.2,
  retries: 0,
};

const QUOTES = ["'", '"', "`"];

// Only test files and the Playwright config can weaken a test, so every other file is accepted.
function isJudged(file: string): boolean {
  if (file.endsWith(".spec.ts")) {
    return true;
  }
  return /(^|\/)playwright\.config\.ts$/.test(file);
}

// ---- Reading a Claude Code hook payload ----

// A Write replaces a whole file, so the text before is whatever is on disk now.
function changeFromWrite(file: string, input: ToolInput): Change {
  let before = "";
  if (existsSync(file)) {
    before = readFileSync(file, "utf8");
  }
  return { file, before, after: input.content ?? "" };
}

// An Edit only shows the replaced snippet, so the guard compares the old and new snippets.
// MultiEdit sends a list of such snippets; a plain Edit is a list of one.
function changesFromEdit(file: string, input: ToolInput): Change[] {
  const edits = input.edits ?? [input];
  return edits.map((edit) => ({
    file,
    before: edit.old_string ?? "",
    after: edit.new_string ?? "",
  }));
}

function changesFromHook(hook: HookInput): Change[] {
  const input = hook.tool_input ?? {};
  const file = input.file_path ?? "";
  if (hook.tool_name === "Write") {
    return [changeFromWrite(file, input)];
  }
  return changesFromEdit(file, input);
}

// ---- Reading a unified diff ----

// A header line looks like `+++ b/tests/basket.spec.ts`, possibly followed by a tab and a date.
function pathFromHeader(header: string): string {
  const withoutMarker = header.slice(4);
  const withoutDate = withoutMarker.split("\t")[0];
  return withoutDate.replace(/^[ab]\//, "");
}

// When a file is deleted the new path is /dev/null, so the old path names the file instead.
function fileFromHeaders(oldHeader: string, newHeader: string): string {
  if (newHeader.endsWith("/dev/null")) {
    return pathFromHeader(oldHeader);
  }
  return pathFromHeader(newHeader);
}

// Lines that describe the diff rather than the code, and so belong to neither side.
function isDiffMetadata(line: string): boolean {
  return line.startsWith("diff ") || line.startsWith("@@") || line.startsWith("\\");
}

// Context lines (a leading space, or an empty line) exist on both sides of the change.
function addHunkLine(change: Change, line: string): void {
  const marker = line[0];
  const text = line.slice(1);
  if (marker === " " || marker === undefined) {
    change.before += `${text}\n`;
    change.after += `${text}\n`;
  } else if (marker === "-") {
    change.before += `${text}\n`;
  } else if (marker === "+") {
    change.after += `${text}\n`;
  }
}

// A new file starts with a `--- a/x` line directly followed by a `+++ b/x` line.
// Checking both lines stops a removed line that happens to begin with `--` from looking like one.
function isFileHeader(line: string, previous: string, next: string): boolean {
  if (line.startsWith("--- ") && next.startsWith("+++ ")) {
    return true;
  }
  return line.startsWith("+++ ") && previous.startsWith("--- ");
}

// The second header line has both paths in view, so that is where a new file begins.
function startFileAtHeader(changes: Change[], line: string, previous: string): void {
  if (line.startsWith("+++ ")) {
    changes.push({ file: fileFromHeaders(previous, line), before: "", after: "" });
  }
}

function changesFromDiff(diff: string): Change[] {
  const changes: Change[] = [];
  const lines = diff.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const previous = lines[index - 1] ?? "";
    const next = lines[index + 1] ?? "";
    if (isFileHeader(line, previous, next)) {
      startFileAtHeader(changes, line, previous);
      continue;
    }
    const current = changes.at(-1);
    if (current !== undefined && !isDiffMetadata(line)) {
      addHunkLine(current, line);
    }
  }
  return changes;
}

// ---- Reading standard input ----

// Hook payloads are JSON objects; anything that does not parse as one is treated as a diff.
function parseHook(input: string): HookInput | undefined {
  try {
    const parsed: unknown = JSON.parse(input);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as HookInput;
    }
  } catch {
    // Not JSON, so it must be a diff.
  }
  return undefined;
}

function readChanges(input: string): Change[] {
  const hook = parseHook(input);
  if (hook !== undefined) {
    return changesFromHook(hook);
  }
  return changesFromDiff(input);
}

// ---- What a test promises ----

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  if (matches === null) {
    return 0;
  }
  return matches.length;
}

// Counts expect(...), expect.soft(...) and expect.poll(...).
function countExpects(text: string): number {
  return countMatches(text, /\bexpect(\.\w+)*\s*\(/g);
}

// Counts test.skip, test.fixme and the same on test.describe.
function countSkips(text: string): number {
  return countMatches(text, /\btest(\.describe)?\.(skip|fixme)\b/g);
}

// Finds the closing quote of a string, given the position of its opening quote.
// A backslash escapes the next character, so "say \"hi\"" is read as one string.
function findStringEnd(text: string, openingQuote: number): number {
  const quote = text[openingQuote];
  for (let index = openingQuote + 1; index < text.length; index++) {
    if (text[index] === "\\") {
      index++;
    } else if (text[index] === quote) {
      return index;
    }
  }
  return text.length;
}

// Finds where a call's arguments end, given the position just after its opening bracket.
// It skips over strings so that a bracket inside "($2.99)" does not end the call early.
// When the text ends before the call closes, as in a cut-off diff hunk, it returns the text end.
function findArgumentsEnd(text: string, start: number): number {
  let depth = 1;
  for (let index = start; index < text.length; index++) {
    const character = text[index];
    if (QUOTES.includes(character)) {
      index = findStringEnd(text, index);
    } else if (character === "(") {
      depth++;
    } else if (character === ")") {
      depth--;
      if (depth === 0) {
        return index;
      }
    }
  }
  return text.length;
}

// Whitespace and a trailing comma are formatting, not meaning, so they must not count as a change.
function normalizeArguments(argumentsText: string): string {
  const singleSpaced = argumentsText.replace(/\s+/g, " ");
  const withoutTrailingComma = singleSpaced.replace(/,?\s*$/, "");
  return withoutTrailingComma.trim();
}

// Lists every matcher call with its arguments, such as `.not.toHaveText("$12.40")`.
// The locator lives inside expect(...), not in the matcher, so changing a locator leaves these
// alone, while changing an expected value or dropping `.not` changes them.
function listMatchers(text: string): string[] {
  const matchers: string[] = [];
  for (const match of text.matchAll(/(\.not)?\.(to[A-Z]\w*)\s*\(/g)) {
    const negation = match[1] ?? "";
    const name = match[2];
    const start = (match.index ?? 0) + match[0].length;
    const end = findArgumentsEnd(text, start);
    const argumentsText = normalizeArguments(text.slice(start, end));
    matchers.push(`${negation}.${name}(${argumentsText})`);
  }
  return matchers;
}

// Finds the largest number given to a setting, so `retries: process.env.CI ? 3 : 0` counts as 3.
function readTolerance(text: string, setting: string): number {
  const pattern = new RegExp(`\\b${setting}\\s*:\\s*([^,}\\n]+)`, "g");
  const values: number[] = [];
  for (const match of text.matchAll(pattern)) {
    const numbers = match[1].match(/\d*\.?\d+/g) ?? [];
    for (const number of numbers) {
      values.push(Number(number));
    }
  }
  if (values.length === 0) {
    return DEFAULT_TOLERANCES[setting];
  }
  return Math.max(...values);
}

// ---- The verdict ----

function findRaisedTolerance(change: Change): string | undefined {
  for (const setting of Object.keys(DEFAULT_TOLERANCES)) {
    const was = readTolerance(change.before, setting);
    const now = readTolerance(change.after, setting);
    if (now > was) {
      return `raises ${setting} (${was} -> ${now})`;
    }
  }
  return undefined;
}

// Every matcher from before must still be there afterwards, each one matched only once,
// so that moving a matcher is fine but changing one is not.
function findChangedMatcher(change: Change): string | undefined {
  const remaining = listMatchers(change.after);
  for (const matcher of listMatchers(change.before)) {
    const position = remaining.indexOf(matcher);
    if (position === -1) {
      return `changes an expected value: ${matcher}`;
    }
    remaining.splice(position, 1);
  }
  return undefined;
}

// Returns why the change weakens a test, or undefined when it does not.
function findWeakening(change: Change): string | undefined {
  const expectsBefore = countExpects(change.before);
  const expectsAfter = countExpects(change.after);
  if (expectsAfter < expectsBefore) {
    return `removes an expect (${expectsBefore} -> ${expectsAfter})`;
  }
  if (countSkips(change.after) > countSkips(change.before)) {
    return "adds test.skip or test.fixme";
  }
  return findRaisedTolerance(change) ?? findChangedMatcher(change);
}

async function main(): Promise<void> {
  const input = await Bun.stdin.text();
  for (const change of readChanges(input)) {
    if (!isJudged(change.file)) {
      continue;
    }
    const reason = findWeakening(change);
    if (reason !== undefined) {
      console.error(`guard: ${change.file}: ${reason}`);
      process.exit(2);
    }
  }
  process.exit(0);
}

await main();
