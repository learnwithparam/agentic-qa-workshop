// guard-the-assertions: the learner's qa/guard.ts must stop any agent from weakening a test.
// The check feeds it 8 planted diffs on stdin, then the exact JSON Claude Code sends a PreToolUse
// hook for Edit and Write. Exit 2 rejects, with the reason on stderr. Exit 0 accepts.
// No model is called: the guard is plain code, so its answers are the same every run.
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "../scripts/structure";
import type { Rule } from "../scripts/verify";

const DIFFS = join(ROOT, "checks", "fixtures", "guard-the-assertions");
const STARTER_TESTS = join(
  ROOT,
  "parts",
  "02-prove-the-tests-catch-bugs",
  "03-guard-the-assertions",
  "problem",
  "tests",
);
const SECONDS_TO_ANSWER = 10;

type Answer = { exitCode: number; reason: string };

// Runs the guard the way Claude Code runs a hook: the input arrives on stdin.
function askGuard(folder: string, input: string): Answer {
  const guard = join(folder, "qa", "guard.ts");
  if (!existsSync(guard)) return { exitCode: -1, reason: "" };
  const finished = Bun.spawnSync(["bun", guard], {
    cwd: folder,
    stdin: new TextEncoder().encode(input),
    stdout: "pipe",
    stderr: "pipe",
    timeout: SECONDS_TO_ANSWER * 1000,
  });
  return { exitCode: finished.exitCode ?? -1, reason: finished.stderr.toString().trim() };
}

const plantedDiff = (name: string) => readFileSync(join(DIFFS, `${name}.diff`), "utf8");

function rejectsDiff(folder: string, name: string): boolean {
  const answer = askGuard(folder, plantedDiff(name));
  return answer.exitCode === 2 && answer.reason.length > 0;
}

function acceptsDiff(folder: string, name: string): boolean {
  return askGuard(folder, plantedDiff(name)).exitCode === 0;
}

// Claude Code names these fields in snake_case, so the check must use the same names.
// biome-ignore-start lint/style/useNamingConvention: Claude Code's hook fields are snake_case
function preToolUse(folder: string, toolName: string, toolInput: Record<string, unknown>) {
  return JSON.stringify({
    session_id: "abc123",
    transcript_path: "/home/learner/.claude/projects/pantry/abc123.jsonl",
    cwd: folder,
    permission_mode: "acceptEdits",
    hook_event_name: "PreToolUse",
    tool_name: toolName,
    tool_input: toolInput,
    tool_use_id: "toolu_01ABC123",
  });
}

type Edit = { file: string; oldText: string; newText: string };

function editCall(folder: string, edit: Edit) {
  const toolInput = {
    file_path: edit.file,
    old_string: edit.oldText,
    new_string: edit.newText,
    replace_all: false,
  };
  return preToolUse(folder, "Edit", toolInput);
}

function writeCall(folder: string, file: string, content: string) {
  return preToolUse(folder, "Write", { file_path: file, content });
}
// biome-ignore-end lint/style/useNamingConvention: Claude Code's hook fields are snake_case

const BANANA_TOTAL = '    await expect(lineTotal(page, "Bananas, loose")).toHaveText("$1.04");';
const BANANA_WEIGHT = '    await expect(page.getByTestId("line-weight")).toHaveText("750 g");';
const BOOK_BUTTON = '    await page.getByRole("button", { name: "Book slot" }).click();';

// A private copy of the starter tests, so a Write call has a real file on disk to compare with.
function withTestCopy<T>(work: (testsFolder: string) => T): T {
  const copy = mkdtempSync(join(tmpdir(), "guard-"));
  cpSync(STARTER_TESTS, join(copy, "tests"), { recursive: true });
  try {
    return work(join(copy, "tests"));
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
}

function hookBlocksChangedTotal(folder: string): boolean {
  return withTestCopy((tests) => {
    const newText = BANANA_TOTAL.replace("$1.04", "$1.05");
    const edit = { file: join(tests, "basket.spec.ts"), oldText: BANANA_TOTAL, newText };
    return askGuard(folder, editCall(folder, edit)).exitCode === 2;
  });
}

function hookBlocksRemovedExpect(folder: string): boolean {
  return withTestCopy((tests) => {
    const oldText = `${BANANA_WEIGHT}\n${BANANA_TOTAL}`;
    const edit = { file: join(tests, "basket.spec.ts"), oldText, newText: BANANA_TOTAL };
    return askGuard(folder, editCall(folder, edit)).exitCode === 2;
  });
}

function hookBlocksFixmeInWrite(folder: string): boolean {
  return withTestCopy((tests) => {
    const file = join(tests, "slots.spec.ts");
    const original = readFileSync(file, "utf8");
    const rewritten = original.replace(
      'test("Checkout needs a booked slot"',
      'test.fixme("Checkout needs a booked slot"',
    );
    return askGuard(folder, writeCall(folder, file, rewritten)).exitCode === 2;
  });
}

function hookAllowsLocatorEdit(folder: string): boolean {
  return withTestCopy((tests) => {
    const newText = BOOK_BUTTON.replace("Book slot", "Reserve");
    const edit = { file: join(tests, "slots.spec.ts"), oldText: BOOK_BUTTON, newText };
    return askGuard(folder, editCall(folder, edit)).exitCode === 0;
  });
}

type HookEntry = { matcher?: string; hooks?: { type?: string; command?: string }[] };
// biome-ignore lint/style/useNamingConvention: PreToolUse is the event name Claude Code reads
type Settings = { hooks?: { PreToolUse?: HookEntry[] } };

function readSettings(folder: string): Settings {
  const path = join(folder, ".claude", "settings.json");
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

// Claude Code reads the matcher as a regular expression over the tool name.
function matchesTool(matcher: string | undefined, toolName: string): boolean {
  if (!matcher || matcher === "*") return true;
  return new RegExp(`^(?:${matcher})$`).test(toolName);
}

function runsTheGuard(entry: HookEntry): boolean {
  const commands = (entry.hooks ?? []).map((hook) => hook.command ?? "");
  return commands.some((command) => command.includes("qa/guard.ts"));
}

function hookIsWired(folder: string): boolean {
  const entries = readSettings(folder).hooks?.PreToolUse ?? [];
  const forEdit = entries.some(
    (entry) => matchesTool(entry.matcher, "Edit") && runsTheGuard(entry),
  );
  const forWrite = entries.some(
    (entry) => matchesTool(entry.matcher, "Write") && runsTheGuard(entry),
  );
  return forEdit && forWrite;
}

// Where a planted diff sits, seen from the step's problem/ folder.
const diffPathFromStep = (name: string) =>
  `../../../../checks/fixtures/guard-the-assertions/${name}.diff`;

const rejectRule = (name: string, says: string): Rule => ({
  says: `rejects a diff that ${says}`,
  test: (folder) => rejectsDiff(folder, name),
  tryNext: `run bun qa/guard.ts < ${diffPathFromStep(name)} and ask Claude Code why it exits 0`,
});

const acceptRule = (name: string, says: string): Rule => ({
  says: `accepts a diff that ${says}`,
  test: (folder) => acceptsDiff(folder, name),
  tryNext: `bun qa/guard.ts < ${diffPathFromStep(name)}; a guard that blocks safe edits is dropped`,
});

export default [
  {
    says: "qa/guard.ts exists",
    test: (folder) => existsSync(join(folder, "qa", "guard.ts")),
    tryNext: "ask Claude Code to write qa/guard.ts with the prompt in the step README",
  },
  rejectRule("removes-an-expect", "removes an expect"),
  rejectRule("adds-test-fixme", "marks a test test.fixme"),
  rejectRule("adds-test-skip", "marks a test test.skip"),
  rejectRule("changes-an-expected-total", 'changes an expected total from "$12.40" to "$12.41"'),
  rejectRule("raises-max-diff-pixels", "raises maxDiffPixels"),
  acceptRule("changes-a-locator", "only changes a locator"),
  acceptRule("adds-an-assertion", "adds an assertion"),
  acceptRule("renames-a-test", "only renames a test"),
  {
    says: "as a hook, blocks an Edit that changes an expected price",
    test: hookBlocksChangedTotal,
    tryNext:
      "the guard must also read the PreToolUse JSON Claude Code sends: " +
      "compare old_string with new_string",
  },
  {
    says: "as a hook, blocks an Edit that removes an expect",
    test: hookBlocksRemovedExpect,
    tryNext: "count the expect calls in old_string and in new_string; fewer means weaker",
  },
  {
    says: "as a hook, blocks a Write that marks a test fixme",
    test: hookBlocksFixmeInWrite,
    tryNext: "for a Write, compare the new content with the file already on disk at file_path",
  },
  {
    says: "as a hook, lets an Edit through that only changes a locator",
    test: hookAllowsLocatorEdit,
    tryNext:
      "a new button name is a locator change; only expected values inside a matcher are protected",
  },
  {
    says: ".claude/settings.json runs qa/guard.ts as a PreToolUse hook on Edit and Write",
    test: hookIsWired,
    tryNext:
      'ask Claude Code to add a PreToolUse hook with "matcher": "Edit|Write" and the command ' +
      'bun "$CLAUDE_PROJECT_DIR/qa/guard.ts"',
  },
] satisfies Rule[];
