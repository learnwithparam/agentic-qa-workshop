// bun test: the Claude Code configuration the finished run uses, tested with no model.
// The hook gets the exact JSON Claude Code sends a PreToolUse hook on stdin, and we assert its exit code.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe as summarize, recordings, redact, RECORDINGS, TEMPLATE } from "../world/finished/run";

const HOOK = join(TEMPLATE, ".claude", "hooks", "test-rules.ts");
const ROOT = join(import.meta.dir, "..");

function preToolUse(tool_name: string, tool_input: Record<string, unknown>) {
  return {
    session_id: "abc123",
    prompt_id: "550e8400-e29b-41d4-a716-446655440000",
    transcript_path: "/home/learner/.claude/projects/pantry/abc123.jsonl",
    cwd: "/home/learner/pantry",
    permission_mode: "acceptEdits",
    hook_event_name: "PreToolUse",
    tool_name,
    tool_input,
    tool_use_id: "toolu_01ABC123",
  };
}

function runHook(input: unknown) {
  const r = Bun.spawnSync(["bun", HOOK], { stdin: new TextEncoder().encode(JSON.stringify(input)), stdout: "pipe", stderr: "pipe" });
  return { code: r.exitCode, stderr: r.stderr.toString() };
}

const SPEC = "/home/learner/pantry/tests/basket.spec.ts";

describe("test-rules hook (PreToolUse on Write and Edit)", () => {
  test("blocks a Write of a test that sleeps", () => {
    const r = runHook(preToolUse("Write", { file_path: SPEC, content: "await page.waitForTimeout(1000);" }));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("waitForTimeout");
  });
  test("blocks an Edit that skips a test", () => {
    const r = runHook(preToolUse("Edit", { file_path: SPEC, old_string: "test(\"total\"", new_string: "test.skip(\"total\"", replace_all: false }));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("test.skip");
  });
  test("blocks an Edit that marks a test fixme", () => {
    expect(runHook(preToolUse("Edit", { file_path: SPEC, old_string: "test(", new_string: "test.fixme(", replace_all: false })).code).toBe(2);
  });
  test("lets a good test through", () => {
    const r = runHook(preToolUse("Write", { file_path: SPEC, content: "await expect(page.getByText(\"$1.04\")).toBeVisible();" }));
    expect(r.code).toBe(0);
    expect(r.stderr).toBe("");
  });
  test("leaves files that are not tests alone", () => {
    expect(runHook(preToolUse("Write", { file_path: "/home/learner/pantry/specs/basket.md", content: "test.skip( is a word here" })).code).toBe(0);
  });
  test("leaves other tools alone", () => {
    expect(runHook(preToolUse("Bash", { command: "bunx playwright test", description: "Run tests", timeout: 120000, run_in_background: false })).code).toBe(0);
  });
  test("a broken payload does not block Claude Code", () => {
    const r = Bun.spawnSync(["bun", HOOK], { stdin: new TextEncoder().encode("not json"), stdout: "pipe", stderr: "pipe" });
    expect(r.exitCode).toBe(0);
  });
});

describe("settings.json", () => {
  const s = JSON.parse(readFileSync(join(TEMPLATE, ".claude", "settings.json"), "utf8"));
  test("wires the hook on Write and Edit", () => {
    const h = s.hooks.PreToolUse[0];
    expect(h.matcher).toBe("Write|Edit");
    expect(h.hooks[0].command).toContain(".claude/hooks/test-rules.ts");
  });
  test("lets Claude Code write plans and tests and run Playwright, never edit the requirements", () => {
    expect(s.permissions.allow).toContain("Write(tests/**)");
    expect(s.permissions.allow).toContain("Bash(bunx playwright test *)");
    expect(s.permissions.deny).toContain("Edit(requirements/**)");
    expect(s.permissions.deny).toContain("Write(requirements/**)");
  });
});

describe("recordings", () => {
  test("redact strips model ids and home paths", () => {
    const out = redact(JSON.stringify({ model: ["claude", "opus", "9", "9"].join("-"), cwd: "/tmp/run/x", p: "/home/sam/.claude/a.jsonl" }), "/tmp/run/x");
    expect(out).not.toMatch(/claude-opus|sam/);
    expect(out).toContain("<run>");
  });
  test("a transcript line reads as one short line", () => {
    const line = JSON.stringify({ type: "assistant", parent_tool_use_id: null, message: { content: [{ type: "tool_use", name: "Write", input: { file_path: "/x/tests/slots.spec.ts" } }] } });
    expect(summarize(line)).toBe("  Write tests/slots.spec.ts");
  });
  const recs = recordings();
  test("every recording is a real claude -p stream-json transcript that finished, with the files it wrote", () => {
    for (const r of recs) {
      const dir = join(RECORDINGS, r);
      const events = readFileSync(join(dir, "transcript.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
      expect(events.find((e) => e.type === "system" && e.subtype === "init")).toBeTruthy();
      expect(events.at(-1).type).toBe("result");
      for (const f of ["specs/slots.md", "specs/basket.md", "tests/slots.spec.ts", "tests/basket.spec.ts"]) expect(existsSync(join(dir, "files", f))).toBe(true);
    }
  });
});

test("no model API in the repo: Claude Code is the only way the course reaches a model", () => {
  const banned = /@ai-sdk\/|@anthropic-ai\/sdk|openrouter|LLM_PROVIDER|ANTHROPIC_API_KEY/i;
  const skip = new Set(["node_modules", ".git", ".runs", "recordings"]);
  const hits: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (skip.has(e.name)) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx|md|json|toml|lock|ya?ml)$/.test(e.name) || e.name.startsWith(".env")) {
        if (p.endsWith("claude-code.test.ts")) continue;
        if (banned.test(readFileSync(p, "utf8"))) hits.push(p.slice(ROOT.length + 1));
      }
    }
  };
  walk(ROOT);
  expect(hits).toEqual([]);
});
