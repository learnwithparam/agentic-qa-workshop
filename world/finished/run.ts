// bun run finished: the finished system. Claude Code, with the course's CLAUDE.md, settings,
// hook and Playwright's planner and generator agents, plans and writes a suite for Pantry Run
// in a fresh folder. Then the bug-kill matrix scores what it wrote.
//
//   bun run finished               a live run when claude is installed and signed in, else a replay
//   bun run finished --replay [N]  replay recording N (default 1), or every one with --replay all
//   bun run finished --record N    a live run, saved as world/recordings/finished-N
//
// A replay reads a real claude -p transcript and the files that run wrote, from world/recordings/.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { browserEnv } from "../../checks/lib/browser";
import { claudeStatus } from "../../checks/lib/claude";
import { bugKillMatrix, printMatrix } from "../../checks/lib/matrix";
import { startShop } from "../../checks/lib/world";
import { ROOT } from "../../scripts/structure";
import { BUGS } from "../bugs";
import { scorePlans, scoreTests } from "./score";

export const TEMPLATE = join(import.meta.dir, "template");
export const RECORDINGS = join(ROOT, "world", "recordings");
export const PROMPT = [
  "Plan and write the Pantry Run test suite, following CLAUDE.md.",
  [
    "First use the playwright-test-planner agent to plan from requirements/slots.md",
    "and requirements/basket.md with tests/seed.spec.ts as the seed,",
    "and save specs/slots.md and specs/basket.md.",
  ].join(" "),
  [
    "Then use the playwright-test-generator agent to write tests/slots.spec.ts",
    "and tests/basket.spec.ts from those plans.",
  ].join(" "),
  "Run bunx playwright test until every test passes, then say how many tests you wrote.",
].join(" ");
// The same allow list as the template's .claude/settings.json, given on the command line too:
// Claude Code ignores a project's allow list until someone accepts the folder's trust dialog,
// and a fresh copy is untrusted.
export const ALLOWED = [
  "mcp__playwright-test",
  "Bash(bunx playwright test)",
  "Bash(bunx playwright test *)",
  "Write(specs/**)",
  "Edit(specs/**)",
  "Write(tests/**)",
  "Edit(tests/**)",
].join(",");
export const FLAGS = [
  "--output-format",
  "stream-json",
  "--verbose",
  "--permission-mode",
  "acceptEdits",
  "--allowedTools",
  ALLOWED,
  "--max-turns",
  "200",
];

// The allow list holds spaces and stars, so the printed command puts it in quotes.
function quoteAllowList(commandFlag: string): string {
  if (commandFlag === ALLOWED) return `"${commandFlag}"`;
  return commandFlag;
}
const QUOTED_FLAGS = FLAGS.map(quoteAllowList);
export const COMMAND = `claude -p "<PROMPT>" ${QUOTED_FLAGS.join(" ")}`;

// The run plans slots and basket, as Part 1 does.
// So it is scored on the requirement bugs in those areas.
// The substitution bugs are Part 2's job (catch-the-seeded-bugs).
function isSlotOrBasketBug(bug: (typeof BUGS)[number]): boolean {
  const breaksSlotsOrBasket = /^(SLOT|BASK)-/.test(bug.breaks);
  return bug.group === "requirement" && breaksSlotsOrBasket;
}
export const RUN_BUGS = BUGS.filter(isSlotOrBasketBug).map((bug) => bug.id);
const PRODUCED = ["specs", "tests"];

const commandLineArguments = process.argv.slice(2);

// The value after a flag on the command line, "" when the flag has no value, null when absent.
function flagValue(flagName: string): string | null {
  const position = commandLineArguments.indexOf(flagName);
  if (position < 0) return null;
  return commandLineArguments[position + 1] ?? "";
}

// One event from a claude -p stream-json transcript. Its fields are snake_case, as Claude Code
// writes them, so they are read here by those names.
type TranscriptEvent = Record<string, unknown>;
type ToolInput = Record<string, unknown>;

function parseEvent(line: string): TranscriptEvent | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

// The short part of a file path a reader needs: its folder and its name.
function lastTwoPathParts(path: unknown): string | undefined {
  if (typeof path !== "string") return undefined;
  const parts = path.split("/");
  return parts.slice(-2).join("/");
}

// What a tool call works on: the agent, the file, the command, the page or the element.
function toolTarget(input: ToolInput): string {
  const target =
    input.subagent_type ??
    lastTwoPathParts(input.file_path) ??
    input.command ??
    input.url ??
    input.element ??
    input.pattern ??
    "";
  return String(target).slice(0, 90);
}

function describeToolCalls(event: TranscriptEvent, indent: string): string | null {
  const message = event.message as { content?: Record<string, unknown>[] } | undefined;
  const summaries: string[] = [];
  for (const part of message?.content ?? []) {
    if (part.type !== "tool_use") continue;
    const input = (part.input ?? {}) as ToolInput;
    const toolName = String(part.name).replace(/^mcp__playwright-test__/, "browser: ");
    const summary = `${indent}${toolName} ${toolTarget(input)}`;
    summaries.push(summary.trimEnd());
  }
  if (summaries.length === 0) return null;
  return summaries.join("\n");
}

// The first line of the final answer that has any text, in quotes after a full stop.
function firstAnswerLine(result: unknown): string {
  if (!result) return "";
  const answerLines = String(result).split("\n");
  const firstLine = answerLines.find((answerLine) => answerLine.trim()) ?? "";
  return `. "${firstLine}"`;
}

function describeResult(event: TranscriptEvent): string {
  const answer = firstAnswerLine(event.result);
  return `  Claude Code finished: ${event.subtype}, ${event.num_turns} turns${answer}`;
}

function describeStart(event: TranscriptEvent): string {
  const version = event.claude_code_version ?? "";
  return `  Claude Code ${version} started (permission mode ${event.permissionMode})`;
}

function describeBlockedHook(event: TranscriptEvent, indent: string): string {
  const reason = String(event.stderr ?? "").trim();
  return `${indent}hook blocked: ${reason}`;
}

function isSystemEvent(event: TranscriptEvent, subtype: string): boolean {
  return event.type === "system" && event.subtype === subtype;
}

// One short line per event in a claude -p stream-json transcript, so a replay reads like the
// live run. It is exported as describe, the name the tests import.
function describeEvent(line: string): string | null {
  const event = parseEvent(line);
  if (event === null || typeof event !== "object") return null;
  // Work done by a subagent is indented one more step than the main agent's work.
  const indent = event.parent_tool_use_id ? "    " : "  ";
  if (isSystemEvent(event, "init")) return describeStart(event);
  if (event.type === "assistant") return describeToolCalls(event, indent);
  const hookBlocked = isSystemEvent(event, "hook_response") && event.exit_code === 2;
  if (hookBlocked) return describeBlockedHook(event, indent);
  if (event.type === "result") return describeResult(event);
  return null;
}

export { describeEvent as describe };

// Strips what must not reach a learner file: model ids, this machine's paths and session ids.
export function redact(line: string, runDir: string): string {
  const withRunFolder = line.split(runDir).join("<run>");
  const withoutModelField = withRunFolder.replace(/"model":"[^"]*"/g, '"model":"(model)"');
  const withoutModelNames = withoutModelField.replace(
    /\bclaude-(opus|sonnet|haiku|fable)[a-z0-9.-]*/gi,
    "(model)",
  );
  const withoutHome = withoutModelNames.replace(
    /\/(?:root|home\/[^/"]+|Users\/[^/"]+)\/[^"\s]*/g,
    "<home>",
  );
  return withoutHome.replace(/\/tmp\/claude-[^"\s]*/g, "<tmp>");
}

function freshFolder(name: string): string {
  const folder = join(ROOT, ".runs", "finished", name);
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(folder, { recursive: true });
  cpSync(TEMPLATE, folder, { recursive: true });
  mkdirSync(join(folder, "requirements"));
  for (const requirement of ["slots", "basket", "substitutions"]) {
    const source = join(ROOT, "world", "requirements", `${requirement}.md`);
    cpSync(source, join(folder, "requirements", `${requirement}.md`));
  }
  return folder;
}

// Installs Playwright's planner and generator agents in the folder, as a learner would.
function installPlaywrightAgents(folder: string) {
  const command = ["bun", "x", "playwright", "init-agents", "--loop=claude"];
  const init = Bun.spawnSync(command, { cwd: folder, stdout: "pipe", stderr: "pipe" });
  if (init.exitCode === 0) return;
  const errorLines = init.stderr.toString().trim().split("\n");
  throw new Error(`playwright init-agents failed: ${errorLines.pop()}`);
}

// Reads Claude Code's output line by line as it arrives, printing a short line for each event.
async function collectTranscript(output: ReadableStream<Uint8Array>): Promise<string[]> {
  const lines: string[] = [];
  const decoder = new TextDecoder();
  let unfinished = "";
  for await (const chunk of output) {
    unfinished += decoder.decode(chunk);
    let newlineAt = unfinished.indexOf("\n");
    while (newlineAt >= 0) {
      const line = unfinished.slice(0, newlineAt);
      unfinished = unfinished.slice(newlineAt + 1);
      newlineAt = unfinished.indexOf("\n");
      if (!line.trim()) continue;
      lines.push(line);
      const summary = describeEvent(line);
      if (summary) console.log(summary);
    }
  }
  if (unfinished.trim()) lines.push(unfinished);
  return lines;
}

async function live(record: string | null): Promise<string> {
  const folder = freshFolder(record ? `record-${record}` : `live-${Date.now()}`);
  installPlaywrightAgents(folder);
  const shop = await startShop();
  const shownFolder = relative(ROOT, folder);
  console.log(
    `Live run: Claude Code plans and writes the suite in ${shownFolder} against a fresh shop.`,
  );
  let lines: string[] = [];
  try {
    const claude = Bun.spawn(["claude", "-p", PROMPT, ...FLAGS], {
      cwd: folder,
      // biome-ignore lint/style/useNamingConvention: environment variable names are uppercase
      env: { ...process.env, ...browserEnv(), BASE_URL: shop.url },
      stdout: "pipe",
      stderr: "inherit",
    });
    lines = await collectTranscript(claude.stdout);
    await claude.exited;
  } finally {
    shop.stop();
  }
  if (record) save(record, folder, lines);
  return folder;
}

function finalResult(lines: string[]): TranscriptEvent {
  const events = lines.map((line) => parseEvent(line) ?? {});
  // A run that waits on background agents emits a result per turn.
  // The last one is how the run ended.
  const results = events.filter((event) => event.type === "result");
  return results.at(-1) ?? {};
}

function recordingDetails(lines: string[]) {
  const result = finalResult(lines);
  const details = {
    command: COMMAND,
    prompt: PROMPT,
    folder: [
      "a fresh copy of world/finished/template, with world/requirements copied in",
      "and bunx playwright init-agents --loop=claude run first",
    ].join(" "),
    claudeCode: claudeStatus().version,
    result: result.subtype ?? "none",
    turns: result.num_turns ?? null,
  };
  return `${JSON.stringify(details, null, 2)}\n`;
}

function save(recordingNumber: string, folder: string, lines: string[]) {
  const recording = join(RECORDINGS, `finished-${recordingNumber}`);
  rmSync(recording, { recursive: true, force: true });
  mkdirSync(join(recording, "files"), { recursive: true });
  const redactedLines = lines.map((line) => redact(line, folder));
  writeFileSync(join(recording, "transcript.jsonl"), `${redactedLines.join("\n")}\n`);
  for (const produced of PRODUCED) {
    const source = join(folder, produced);
    if (existsSync(source)) cpSync(source, join(recording, "files", produced), { recursive: true });
  }
  writeFileSync(join(recording, "meta.json"), recordingDetails(lines));
  console.log(`Saved the recording to ${relative(ROOT, recording)}.`);
}

function isRecording(name: string): boolean {
  return /^finished-\d+$/.test(name) && existsSync(join(RECORDINGS, name, "transcript.jsonl"));
}

export function recordings(): string[] {
  if (!existsSync(RECORDINGS)) return [];
  const names = readdirSync(RECORDINGS).filter(isRecording);
  return names.sort();
}

function replay(name: string): string {
  const recording = join(RECORDINGS, name);
  const transcript = readFileSync(join(recording, "transcript.jsonl"), "utf8");
  for (const line of transcript.split("\n")) {
    const summary = describeEvent(line);
    if (summary) console.log(summary);
  }
  const folder = freshFolder(`replay-${name}`);
  for (const produced of PRODUCED) {
    const source = join(recording, "files", produced);
    if (existsSync(source)) cpSync(source, join(folder, produced), { recursive: true });
  }
  return folder;
}

async function score(folder: string): Promise<boolean> {
  console.log("");
  const plans = scorePlans(folder);
  const tests = scoreTests(folder);
  for (const rule of [...plans.rules, ...tests.rules]) {
    const verdict = rule.ok ? "PASS" : "FAIL";
    console.log(`  ${verdict}  ${rule.says}`);
  }
  const runCount = RUN_BUGS.length;
  console.log(
    `  Running the suite on the fixed build and once per slot and basket bug (${runCount} runs)...`,
  );
  const matrix = await bugKillMatrix(join(folder, "tests"), RUN_BUGS);
  printMatrix(matrix);
  const green = matrix.baseline.ran && matrix.baseline.failed === 0;
  const plansPass = plans.rules.every((rule) => rule.ok);
  const testsPass = tests.rules.every((rule) => rule.ok);
  // Behaviour varies run to run. So the bar is set for any one run,
  // and the result is judged over all three recordings.
  const enoughBugsCaught = matrix.caught >= RUN_BUGS.length - 1;
  const passed = plansPass && testsPass && green && enoughBugsCaught;
  console.log("");
  const buildColour = green ? "green" : "RED";
  console.log(
    `Finished run: plans cover ${plans.covered} of ${plans.total} requirements, ` +
      `${tests.count} tests, fixed build ${buildColour}, ` +
      `${matrix.caught} of ${matrix.rows.length} slot and basket bugs caught.`,
  );
  return passed;
}

type ClaudeStatus = ReturnType<typeof claudeStatus>;

// Says in plain words why this run is a replay and not a live run.
function replayReason(replayArgument: string | null, status: ClaudeStatus): string {
  if (replayArgument !== null) return "you asked for a replay";
  if (process.env.CI) return "CI has no signed-in Claude Code";
  if (!status.installed) return "Claude Code is not installed";
  return "Claude Code is not signed in";
}

function replayFolders(replayArgument: string | null, status: ClaudeStatus): string[] {
  const all = recordings();
  if (all.length === 0) {
    console.log("No recordings in world/recordings. See world/recordings/RECORD.md.");
    process.exit(2);
  }
  const picked = replayArgument === "all" ? all : [`finished-${replayArgument || "1"}`];
  const reason = replayReason(replayArgument, status);
  const folders: string[] = [];
  for (const name of picked) {
    if (!all.includes(name)) {
      console.log(`No recording ${name}. Recordings: ${all.join(", ")}.`);
      process.exit(2);
    }
    const recordingPath = `world/recordings/${name}`;
    console.log(
      `Replay: ${reason}, so this replays the recorded Claude Code run in ${recordingPath}.`,
    );
    folders.push(replay(name));
  }
  return folders;
}

async function runFolders(): Promise<string[]> {
  const record = flagValue("--record");
  const replayArgument = flagValue("--replay");
  const status = claudeStatus();
  const canLive = status.installed && status.signedIn && !process.env.CI;
  if (record !== null) {
    if (!canLive) {
      console.log("Recording needs Claude Code installed and signed in. Run bun run doctor.");
      process.exit(2);
    }
    const recordingNumber = record || String(recordings().length + 1);
    return [await live(recordingNumber)];
  }
  if (replayArgument === null && canLive) return [await live(null)];
  return replayFolders(replayArgument, status);
}

if (import.meta.main) {
  const folders = await runFolders();
  let passed = true;
  // Every folder is scored, even after one fails, so the learner sees every result.
  for (const folder of folders) passed = (await score(folder)) && passed;
  process.exit(passed ? 0 : 1);
}
