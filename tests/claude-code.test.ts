// bun test: the Claude Code configuration the finished run uses, tested with no model.
// The hook gets the exact JSON Claude Code sends a PreToolUse hook on stdin.
// We check the exit code it returns.
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RECORDINGS,
  recordings,
  redact,
  describe as summarize,
  TEMPLATE,
} from "../world/finished/run";

const HOOK = join(TEMPLATE, ".claude", "hooks", "test-rules.ts");
const ROOT = join(import.meta.dir, "..");

// Claude Code names these fields in snake_case, so the test must use the same names.
// biome-ignore-start lint/style/useNamingConvention: Claude Code's hook fields are snake_case
function preToolUse(toolName: string, toolInput: Record<string, unknown>) {
  return {
    session_id: "abc123",
    prompt_id: "550e8400-e29b-41d4-a716-446655440000",
    transcript_path: "/home/learner/.claude/projects/pantry/abc123.jsonl",
    cwd: "/home/learner/pantry",
    permission_mode: "acceptEdits",
    hook_event_name: "PreToolUse",
    tool_name: toolName,
    tool_input: toolInput,
    tool_use_id: "toolu_01ABC123",
  };
}

function writeInput(filePath: string, content: string) {
  return { file_path: filePath, content };
}

function editInput(filePath: string, oldText: string, newText: string) {
  return { file_path: filePath, old_string: oldText, new_string: newText, replace_all: false };
}

const BASH_INPUT = {
  command: "bunx playwright test",
  description: "Run tests",
  timeout: 120000,
  run_in_background: false,
};
// biome-ignore-end lint/style/useNamingConvention: Claude Code's hook fields are snake_case

// Runs the hook as Claude Code would: the payload goes in on stdin.
function runHookWithText(text: string) {
  const finished = Bun.spawnSync(["bun", HOOK], {
    stdin: new TextEncoder().encode(text),
    stdout: "pipe",
    stderr: "pipe",
  });
  return { code: finished.exitCode, stderr: finished.stderr.toString() };
}

function runHook(input: unknown) {
  return runHookWithText(JSON.stringify(input));
}

const SPEC = "/home/learner/pantry/tests/basket.spec.ts";

describe("test-rules hook (PreToolUse on Write and Edit)", () => {
  test("blocks a Write of a test that sleeps", () => {
    const sleepingTest = writeInput(SPEC, "await page.waitForTimeout(1000);");
    const hook = runHook(preToolUse("Write", sleepingTest));
    expect(hook.code).toBe(2);
    expect(hook.stderr).toContain("waitForTimeout");
  });
  test("blocks an Edit that skips a test", () => {
    const skippingEdit = editInput(SPEC, 'test("total"', 'test.skip("total"');
    const hook = runHook(preToolUse("Edit", skippingEdit));
    expect(hook.code).toBe(2);
    expect(hook.stderr).toContain("test.skip");
  });
  test("blocks an Edit that marks a test fixme", () => {
    const fixmeEdit = editInput(SPEC, "test(", "test.fixme(");
    expect(runHook(preToolUse("Edit", fixmeEdit)).code).toBe(2);
  });
  test("lets a good test through", () => {
    const goodTest = writeInput(SPEC, 'await expect(page.getByText("$1.04")).toBeVisible();');
    const hook = runHook(preToolUse("Write", goodTest));
    expect(hook.code).toBe(0);
    expect(hook.stderr).toBe("");
  });
  test("leaves files that are not tests alone", () => {
    const planFile = writeInput(
      "/home/learner/pantry/specs/basket.md",
      "test.skip( is a word here",
    );
    expect(runHook(preToolUse("Write", planFile)).code).toBe(0);
  });
  test("leaves other tools alone", () => {
    expect(runHook(preToolUse("Bash", BASH_INPUT)).code).toBe(0);
  });
  test("a broken payload does not block Claude Code", () => {
    expect(runHookWithText("not json").code).toBe(0);
  });
});

describe("settings.json", () => {
  const settingsPath = join(TEMPLATE, ".claude", "settings.json");
  const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  test("wires the hook on Write and Edit", () => {
    const hookEntry = settings.hooks.PreToolUse[0];
    expect(hookEntry.matcher).toBe("Write|Edit");
    expect(hookEntry.hooks[0].command).toContain(".claude/hooks/test-rules.ts");
  });
  const permissionsTitle =
    "lets Claude Code write plans and tests and run Playwright, never edit the requirements";
  test(permissionsTitle, () => {
    expect(settings.permissions.allow).toContain("Write(tests/**)");
    expect(settings.permissions.allow).toContain("Bash(bunx playwright test *)");
    expect(settings.permissions.deny).toContain("Edit(requirements/**)");
    expect(settings.permissions.deny).toContain("Write(requirements/**)");
  });
});

// The files every finished recording must have written.
const WRITTEN_FILES = [
  "specs/slots.md",
  "specs/basket.md",
  "tests/slots.spec.ts",
  "tests/basket.spec.ts",
];

function readTranscript(folder: string) {
  const text = readFileSync(join(folder, "transcript.jsonl"), "utf8");
  const lines = text.trim().split("\n");
  return lines.map((line) => JSON.parse(line));
}

describe("recordings", () => {
  test("redact strips model ids and home paths", () => {
    const transcriptLine = JSON.stringify({
      model: ["claude", "opus", "9", "9"].join("-"),
      cwd: "/tmp/run/x",
      path: "/home/sam/.claude/a.jsonl",
    });
    const redacted = redact(transcriptLine, "/tmp/run/x");
    expect(redacted).not.toMatch(/claude-opus|sam/);
    expect(redacted).toContain("<run>");
  });
  test("a transcript line reads as one short line", () => {
    // biome-ignore-start lint/style/useNamingConvention: transcript fields are snake_case
    const toolUse = {
      type: "tool_use",
      name: "Write",
      input: { file_path: "/x/tests/slots.spec.ts" },
    };
    const line = JSON.stringify({
      type: "assistant",
      parent_tool_use_id: null,
      message: { content: [toolUse] },
    });
    // biome-ignore-end lint/style/useNamingConvention: transcript fields are snake_case
    expect(summarize(line)).toBe("  Write tests/slots.spec.ts");
  });
  const recordingNames = recordings();
  const recordingTitle =
    "every recording is a real claude -p stream-json transcript that finished, " +
    "with the files it wrote";
  test(recordingTitle, () => {
    for (const recordingName of recordingNames) {
      const folder = join(RECORDINGS, recordingName);
      const events = readTranscript(folder);
      const start = events.find((event) => event.type === "system" && event.subtype === "init");
      expect(start).toBeTruthy();
      expect(events.at(-1).type).toBe("result");
      for (const file of WRITTEN_FILES) {
        expect(existsSync(join(folder, "files", file))).toBe(true);
      }
    }
  });
});

// Folders that hold other people's code or recorded output, not the course's own code.
const SKIPPED_FOLDERS = new Set(["node_modules", ".git", ".runs", "recordings"]);
const BANNED = /@ai-sdk\/|@anthropic-ai\/sdk|openrouter|LLM_PROVIDER|ANTHROPIC_API_KEY/i;
const CHECKED_FILE = /\.(ts|tsx|md|json|toml|lock|ya?ml)$/;

function isCheckedFile(name: string): boolean {
  return CHECKED_FILE.test(name) || name.startsWith(".env");
}

// Returns every file under the folder that mentions a model API, relative to the repo.
function filesWithModelApi(folder: string): string[] {
  const hits: string[] = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (SKIPPED_FOLDERS.has(entry.name)) continue;
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      hits.push(...filesWithModelApi(path));
      continue;
    }
    // This file names the banned words on purpose, to look for them.
    if (!isCheckedFile(entry.name) || path.endsWith("claude-code.test.ts")) continue;
    if (BANNED.test(readFileSync(path, "utf8"))) hits.push(path.slice(ROOT.length + 1));
  }
  return hits;
}

test("no model API in the repo: Claude Code is the only way the course reaches a model", () => {
  expect(filesWithModelApi(ROOT)).toEqual([]);
});

test("a test that asserts through a helper in its file counts as checking something", () => {
  const { assertingHelpers } = require("../checks/lib/static");
  const src = `async function expectTotals(page, want) {
  await expect(page.getByTestId("total")).toHaveText(want.total);
}
const goTo = async (page) => { await page.goto("/basket"); };`;
  expect(assertingHelpers(src)).toEqual(["expectTotals"]);
});
