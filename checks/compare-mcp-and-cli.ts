// compare-mcp-and-cli: the same exploring task, run once with Playwright MCP and once with the
// Playwright CLI, both through claude -p. The check reads the two saved stream-json transcripts
// and makes sure every number in qa/mcp-vs-cli.md comes from them, never from a guess.
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { readText } from "./lib/markdown";

type ToolUse = { name: string; command: string };
type Numbers = { tokens: number; turns: number; seconds: number; findings: number };
type Run = (Numbers & { tools: ToolUse[] }) | null;

type ContentBlock = { type?: string; name?: string; input?: { command?: string } };
// One line of a stream-json transcript. Field names are Claude Code's own.
type Line = Record<string, unknown> & {
  type?: string;
  usage?: Record<string, number>;
  result?: string;
  message?: { content?: ContentBlock[] };
};

const RUNS = ["mcp", "cli"] as const;
const FEWEST_WORDS_IN_CHOICE = 12;
const TABLE_ROWS: Record<keyof Numbers, string> = {
  tokens: "Tokens",
  turns: "Turns",
  seconds: "Seconds",
  findings: "Findings",
};
const TOKEN_PARTS = [
  "input_tokens",
  "output_tokens",
  "cache_creation_input_tokens",
  "cache_read_input_tokens",
];

function parseLine(text: string): Line[] {
  try {
    return [JSON.parse(text)];
  } catch {
    // A broken line is skipped. A run with no result line fails below.
    return [];
  }
}

const parseLines = (text: string) => text.split("\n").filter(Boolean).flatMap(parseLine);

function toolUsesOf(line: Line): ToolUse[] {
  if (line.type !== "assistant") return [];
  const blocks = line.message?.content ?? [];
  const toolBlocks = blocks.filter((block) => block.type === "tool_use");
  return toolBlocks.map((block) => ({
    name: block.name ?? "",
    command: block.input?.command ?? "",
  }));
}

// Every token the run used: new input, output, and input written to or read from the cache.
function totalTokens(usage: Record<string, number>): number {
  return TOKEN_PARTS.reduce((total, part) => total + (usage[part] ?? 0), 0);
}

export function readRun(folder: string, name: string): Run {
  const lines = parseLines(readText(join(folder, "qa", "runs", `${name}.jsonl`)));
  const result = lines.findLast((line) => line.type === "result");
  if (!result?.usage) return null;
  const findingLines = (result.result ?? "").match(/^FINDING:/gm) ?? [];
  const durationInMilliseconds = Number(result.duration_ms ?? 0);
  return {
    tools: lines.flatMap(toolUsesOf),
    tokens: totalTokens(result.usage),
    turns: Number(result.num_turns ?? 0),
    seconds: Math.round(durationInMilliseconds / 1000),
    findings: findingLines.length,
  };
}

const isMcpBrowserTool = (tool: ToolUse) => tool.name.startsWith("mcp__playwright__");
const isCliBrowserCommand = (tool: ToolUse) =>
  tool.name === "Bash" && /playwright[ -]cli/.test(tool.command);

const usedMcpBrowser = (run: Run) => run?.tools.some(isMcpBrowserTool) ?? false;
const usedCliBrowser = (run: Run) => run?.tools.some(isCliBrowserCommand) ?? false;

function cellsOf(line: string): string[] {
  const cells = line.split("|").slice(1, -1);
  return cells.map((cell) => cell.trim());
}

// Reads the row of the comparison table that starts with this label, as one number per column.
function tableRow(markdown: string, label: string): Record<string, number> {
  const allLines = markdown.split("\n");
  const lines = allLines.filter((line) => line.trim().startsWith("|"));
  const rows = lines.map(cellsOf);
  const header = rows.find((cells) => cells.some((cell) => /^MCP$/i.test(cell)));
  const row = rows.find((cells) => cells[0]?.toLowerCase() === label.toLowerCase());
  if (!header || !row) return {};
  const values: Record<string, number> = {};
  for (let column = 1; column < header.length; column++) {
    const cell = (row[column] ?? "").replace(/[,$\s]/g, "");
    if (cell !== "") values[header[column].toLowerCase()] = Number(cell);
  }
  return values;
}

const comparison = (folder: string) => readText(join(folder, "qa", "mcp-vs-cli.md"));

function runMatchesTable(markdown: string, name: string, run: Numbers): boolean {
  for (const [field, label] of Object.entries(TABLE_ROWS)) {
    const fromRun = run[field as keyof Numbers];
    if (tableRow(markdown, label)[name] !== fromRun) {
      console.log(`        ${label} for ${name.toUpperCase()}: the run says ${fromRun}`);
      return false;
    }
  }
  return true;
}

function numbersMatchTheRuns(folder: string): boolean {
  const markdown = comparison(folder);
  return RUNS.every((name) => {
    const run = readRun(folder, name);
    return run !== null && runMatchesTable(markdown, name, run);
  });
}

function realFindingsWereJudged(folder: string): boolean {
  const judged = tableRow(comparison(folder), "Real findings");
  return RUNS.every((name) => {
    const run = readRun(folder, name);
    const real = judged[name];
    return run !== null && real !== undefined && real <= run.findings;
  });
}

function choiceHasReason(folder: string): boolean {
  const afterHeading = comparison(folder).split(/^##\s+Choice\s*$/im)[1] ?? "";
  const choice = afterHeading.split(/^##\s/m)[0];
  const namesOne = /\b(MCP|CLI)\b/.test(choice);
  const words = choice.split(/\s+/).filter(Boolean).length;
  return namesOne && words >= FEWEST_WORDS_IN_CHOICE;
}

function cliRunUsedOnlyTheCli(folder: string): boolean {
  const run = readRun(folder, "cli");
  return usedCliBrowser(run) && !usedMcpBrowser(run);
}

export default [
  {
    says: "qa/runs/mcp.jsonl is a finished claude -p run that used the Playwright MCP browser",
    test: (folder) => usedMcpBrowser(readRun(folder, "mcp")),
    tryNext: "run the MCP command from the README and save it as qa/runs/mcp.jsonl",
  },
  {
    says: "qa/runs/cli.jsonl is a finished claude -p run that used the Playwright CLI",
    test: cliRunUsedOnlyTheCli,
    tryNext: "run the CLI command from the README and save it as qa/runs/cli.jsonl",
  },
  {
    says: "tokens, turns, seconds and findings in qa/mcp-vs-cli.md match the two runs",
    test: numbersMatchTheRuns,
    tryNext: "ask Claude Code to read the result line of each run, and never type numbers yourself",
  },
  {
    says: "a Real findings row says how many findings you checked were real",
    test: realFindingsWereJudged,
    tryNext: "open each FINDING in the shop yourself and count only the true ones",
  },
  {
    says: "## Choice names MCP or CLI for the team, with a reason",
    test: choiceHasReason,
    tryNext: "write which one the team will use for exploring, and the number that decided it",
  },
] satisfies Rule[];
