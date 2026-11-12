// bun run finished: the finished system. Claude Code, with the course's CLAUDE.md, settings, hook and
// Playwright's planner and generator agents, plans and writes a suite for Pantry Run in a fresh folder.
// Then the bug-kill matrix scores what it wrote.
//
//   bun run finished                 a live run when claude is installed and signed in, else a replay
//   bun run finished --replay [N]    replay recording N (default 1), or every recording with --replay all
//   bun run finished --record N      a live run, saved as world/recordings/finished-N
//
// A replay reads a real claude -p transcript and the files that run wrote, from world/recordings/.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { BUGS } from "../bugs";
import { ROOT } from "../../scripts/structure";
import { claudeStatus } from "../../checks/lib/claude";
import { browserEnv } from "../../checks/lib/browser";
import { startShop } from "../../checks/lib/world";
import { scorePlans, scoreTests } from "./score";
import { bugKillMatrix, printMatrix } from "../../checks/lib/matrix";

export const TEMPLATE = join(import.meta.dir, "template");
export const RECORDINGS = join(ROOT, "world", "recordings");
export const PROMPT = [
  "Plan and write the Pantry Run test suite, following CLAUDE.md.",
  "First use the playwright-test-planner agent to plan from requirements/slots.md and requirements/basket.md with tests/seed.spec.ts as the seed, and save specs/slots.md and specs/basket.md.",
  "Then use the playwright-test-generator agent to write tests/slots.spec.ts and tests/basket.spec.ts from those plans.",
  "Run bunx playwright test until every test passes, then say how many tests you wrote.",
].join(" ");
// The same allow list as the template's .claude/settings.json, given on the command line too: Claude Code
// ignores a project's allow list until someone accepts the folder's trust dialog, and a fresh copy is untrusted.
export const ALLOWED = "mcp__playwright-test,Bash(bunx playwright test),Bash(bunx playwright test *),Write(specs/**),Edit(specs/**),Write(tests/**),Edit(tests/**)";
export const FLAGS = ["--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits", "--allowedTools", ALLOWED, "--max-turns", "200"];
export const COMMAND = `claude -p "<PROMPT>" ${FLAGS.map((f) => (f === ALLOWED ? `"${f}"` : f)).join(" ")}`;
const REQUIREMENT_BUGS = BUGS.filter((b) => b.group === "requirement").map((b) => b.id);
const PRODUCED = ["specs", "tests"];

const args = process.argv.slice(2);
const flag = (n: string) => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1] ?? ""; };

// One short line per event in a claude -p stream-json transcript, so a replay reads like the live run.
export function describe(line: string): string | null {
  let e: any;
  try { e = JSON.parse(line); } catch { return null; }
  const sub = e.parent_tool_use_id ? "    " : "  ";
  if (e.type === "system" && e.subtype === "init") return `  Claude Code ${e.claude_code_version ?? ""} started (permission mode ${e.permissionMode})`;
  if (e.type === "assistant") {
    const out: string[] = [];
    for (const c of e.message?.content ?? []) {
      if (c.type !== "tool_use") continue;
      const i = c.input ?? {};
      const what = i.subagent_type ?? i.file_path?.split("/").slice(-2).join("/") ?? i.command ?? i.url ?? i.element ?? i.pattern ?? "";
      out.push(`${sub}${c.name.replace(/^mcp__playwright-test__/, "browser: ")} ${String(what).slice(0, 90)}`.trimEnd());
    }
    return out.length ? out.join("\n") : null;
  }
  if (e.type === "system" && e.subtype === "hook_response" && e.exit_code === 2) return `${sub}hook blocked: ${String(e.stderr ?? "").trim()}`;
  if (e.type === "result") return `  Claude Code finished: ${e.subtype}, ${e.num_turns} turns${e.result ? `. "${String(e.result).split("\n").find((l: string) => l.trim()) ?? ""}"` : ""}`;
  return null;
}

// Strips what must not reach a learner file: model ids, this machine's paths and session ids.
export function redact(line: string, runDir: string): string {
  return line
    .split(runDir).join("<run>")
    .replace(/"model":"[^"]*"/g, '"model":"(model)"')
    .replace(/\bclaude-(opus|sonnet|haiku|fable)[a-z0-9.-]*/gi, "(model)")
    .replace(/\/(?:root|home\/[^/"]+|Users\/[^/"]+)\/[^"\s]*/g, "<home>");
}

function freshFolder(name: string): string {
  const dir = join(ROOT, ".runs", "finished", name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(TEMPLATE, dir, { recursive: true });
  mkdirSync(join(dir, "requirements"));
  for (const f of ["slots", "basket", "substitutions"]) cpSync(join(ROOT, "world", "requirements", `${f}.md`), join(dir, "requirements", `${f}.md`));
  return dir;
}

async function live(record: string | null): Promise<string> {
  const dir = freshFolder(record ? `record-${record}` : `live-${Date.now()}`);
  const init = Bun.spawnSync(["bun", "x", "playwright", "init-agents", "--loop=claude"], { cwd: dir, stdout: "pipe", stderr: "pipe" });
  if (init.exitCode !== 0) throw new Error(`playwright init-agents failed: ${init.stderr.toString().trim().split("\n").pop()}`);
  const shop = await startShop();
  console.log(`Live run: Claude Code plans and writes the suite in ${relative(ROOT, dir)} against a fresh shop.`);
  const lines: string[] = [];
  try {
    const proc = Bun.spawn(["claude", "-p", PROMPT, ...FLAGS], {
      cwd: dir,
      env: { ...process.env, ...browserEnv(), BASE_URL: shop.url },
      stdout: "pipe",
      stderr: "inherit",
    });
    const decoder = new TextDecoder();
    let buf = "";
    for await (const chunk of proc.stdout) {
      buf += decoder.decode(chunk);
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        lines.push(line);
        const d = describe(line);
        if (d) console.log(d);
      }
    }
    if (buf.trim()) lines.push(buf);
    await proc.exited;
  } finally {
    shop.stop();
  }
  if (record) save(record, dir, lines);
  return dir;
}

function save(n: string, dir: string, lines: string[]) {
  const out = join(RECORDINGS, `finished-${n}`);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, "files"), { recursive: true });
  writeFileSync(join(out, "transcript.jsonl"), lines.map((l) => redact(l, dir)).join("\n") + "\n");
  for (const p of PRODUCED) if (existsSync(join(dir, p))) cpSync(join(dir, p), join(out, "files", p), { recursive: true });
  const result = lines.map((l) => { try { return JSON.parse(l); } catch { return {}; } }).find((e) => e.type === "result") ?? {};
  writeFileSync(join(out, "meta.json"), JSON.stringify({
    command: COMMAND,
    prompt: PROMPT,
    folder: "a fresh copy of world/finished/template, with world/requirements copied in and bunx playwright init-agents --loop=claude run first",
    claudeCode: claudeStatus().version,
    result: result.subtype ?? "none",
    turns: result.num_turns ?? null,
  }, null, 2) + "\n");
  console.log(`Saved the recording to ${relative(ROOT, out)}.`);
}

export function recordings(): string[] {
  if (!existsSync(RECORDINGS)) return [];
  return readdirSync(RECORDINGS).filter((d) => /^finished-\d+$/.test(d) && existsSync(join(RECORDINGS, d, "transcript.jsonl"))).sort();
}

function replay(name: string): string {
  const rec = join(RECORDINGS, name);
  for (const line of readFileSync(join(rec, "transcript.jsonl"), "utf8").split("\n")) {
    const d = describe(line);
    if (d) console.log(d);
  }
  const dir = freshFolder(`replay-${name}`);
  for (const p of PRODUCED) if (existsSync(join(rec, "files", p))) cpSync(join(rec, "files", p), join(dir, p), { recursive: true });
  return dir;
}

async function score(dir: string): Promise<boolean> {
  console.log("");
  const plans = scorePlans(dir);
  const tests = scoreTests(dir);
  for (const r of [...plans.rules, ...tests.rules]) console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.says}`);
  console.log(`  Running the suite on the fixed build and once per requirement bug (${REQUIREMENT_BUGS.length} runs)...`);
  const m = await bugKillMatrix(join(dir, "tests"), REQUIREMENT_BUGS);
  printMatrix(m);
  const green = m.baseline.ran && m.baseline.failed === 0;
  const ok = plans.rules.every((r) => r.ok) && tests.rules.every((r) => r.ok) && green && m.caught >= 7;
  console.log("");
  console.log(`Finished run: plans cover ${plans.covered} of ${plans.total} requirements, ${tests.count} tests, fixed build ${green ? "green" : "RED"}, ${m.caught} of ${m.rows.length} requirement bugs caught.`);
  return ok;
}

if (import.meta.main) {
  const record = flag("--record");
  const replayArg = flag("--replay");
  const s = claudeStatus();
  const canLive = s.installed && s.signedIn && !process.env.CI;
  let dirs: string[] = [];
  if (record !== null) {
    if (!canLive) { console.log("Recording needs Claude Code installed and signed in. Run bun run doctor."); process.exit(2); }
    dirs = [await live(record || String(recordings().length + 1))];
  } else if (replayArg === null && canLive) {
    dirs = [await live(null)];
  } else {
    const all = recordings();
    if (!all.length) { console.log("No recordings in world/recordings. See world/recordings/RECORD.md."); process.exit(2); }
    const pick = replayArg === "all" ? all : [`finished-${replayArg || "1"}`];
    const why = replayArg !== null ? "you asked for a replay" : process.env.CI ? "CI has no signed-in Claude Code" : !s.installed ? "Claude Code is not installed" : "Claude Code is not signed in";
    for (const name of pick) {
      if (!all.includes(name)) { console.log(`No recording ${name}. Recordings: ${all.join(", ")}.`); process.exit(2); }
      console.log(`Replay: ${why}, so this replays the recorded Claude Code run in world/recordings/${name}.`);
      dirs.push(replay(name));
    }
  }
  let ok = true;
  for (const d of dirs) ok = (await score(d)) && ok;
  process.exit(ok ? 0 : 1);
}
