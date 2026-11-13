// compare-mcp-and-cli: the same exploring task, run once with Playwright MCP and once with the
// Playwright CLI, both through claude -p. The check reads the two saved stream-json transcripts
// and makes sure every number in qa/mcp-vs-cli.md comes from them, never from a guess.
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { readText } from "./lib/markdown";

type ToolUse = { name: string; command: string };
type Run = {
  tools: ToolUse[];
  tokens: number;
  turns: number;
  seconds: number;
  findings: number;
} | null;

type Usage = Record<string, number | undefined>;
type ContentBlock = { type?: string; name?: string; input?: { command?: string } };
type Line = {
  type?: string;
  usage?: Usage;
  num_turns?: number;
  duration_ms?: number;
  result?: string;
  message?: { content?: ContentBlock[] };
};

const RUNS = ["mcp", "cli"] as const;
const FEWEST_WORDS_IN_CHOICE = 12;

function parseLines(text: string): Line[] {
  const lines: Line[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      lines.push(JSON.parse(line));
    } catch {
      // A broken line is skipped. A run with no result line fails below.
    }
  }
  return lines;
}

function toolUsesIn(lines: Line[]): ToolUse[] {
  const uses: ToolUse[] = [];
  for (const line of lines) {
    if (line.type !== "assistant") continue;
    for (const block of line.message?.content ?? []) {
      if (block.type !== "tool_use") continue;
      uses.push({ name: block.name ?? "", command: block.input?.command ?? "" });
    }
  }
  return uses;
}

// Every token the run used: new input, output, and input written to or read from the cache.
function totalTokens(usage: Usage): number {
  const parts = ["input_tokens", "output_tokens", "cache_creation_input_tokens"];
  parts.push("cache_read_input_tokens");
  return parts.reduce((total, part) => total + (usage[part] ?? 0), 0);
}

export function readRun(folder: string, name: string): Run {
  const lines = parseLines(readText(join(folder, "qa", "runs", `${name}.jsonl`)));
  const result = lines.findLast((line) => line.type === "result");
  if (!result?.usage) return null;
  const findingLines = (result.result ?? "").match(/^FINDING:/gm) ?? [];
  return {
    tools: toolUsesIn(lines),
    tokens: totalTokens(result.usage),
    turns: result.num_turns ?? 0,
    seconds: Math.round((result.duration_ms ?? 0) / 1000),
    findings: findingLines.length,
  };
}

const usedMcpBrowser = (run: Run) =>
  run !== null && run.tools.some((tool) => tool.name.startsWith("mcp__playwright__"));

const usedCliBrowser = (run: Run) =>
  run !== null &&
  run.tools.some((tool) => tool.name === "Bash" && /playwright[ -]cli/.test(tool.command));

// Reads the row of the comparison table that starts with this label, as numbers per column.
function tableRow(markdown: string, label: string): Record<string, number> {
  const tableLines = markdown.split("\n").filter((line) => line.trim().startsWith("|"));
  const cellsOf = (line: string) =>
    line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
  const header = tableLines.map(cellsOf).find((cells) => cells.some((cell) => /^MCP$/i.test(cell)));
  const row = tableLines
    .map(cellsOf)
    .find((cells) => cells[0].toLowerCase() === label.toLowerCase());
  if (!header || !row) return {};
  const values: Record<string, number> = {};
  header.forEach((name, index) => {
    const number = Number((row[index] ?? "").replace(/[,$\s]/g, ""));
    if (index > 0 && Number.isFinite(number)) values[name.toLowerCase()] = number;
  });
  return values;
}

const comparison = (folder: string) => readText(join(folder, "qa", "mcp-vs-cli.md"));

function numbersMatchTheRuns(folder: string): boolean {
  const markdown = comparison(folder);
  const rows = { tokens: "Tokens", turns: "Turns", seconds: "Seconds", findings: "Findings" };
  for (const name of RUNS) {
    const run = readRun(folder, name);
    if (!run) return false;
    for (const [field, label] of Object.entries(rows)) {
      const written = tableRow(markdown, label)[name];
      if (written !== run[field as keyof typeof rows]) {
        console.log(
          `        ${label} for ${name.toUpperCase()}: the run says ${run[field as keyof typeof rows]}`,
        );
        return false;
      }
    }
  }
  return true;
}

function realFindingsWereJudged(folder: string): boolean {
  const judged = tableRow(comparison(folder), "Real findings");
  return RUNS.every((name) => {
    const run = readRun(folder, name);
    const real = judged[name];
    return run !== null && real !== undefined && real <= run.findings;
  });
}

function choiceHasAReason(folder: string): boolean {
  const choice =
    comparison(folder)
      .split(/^##\s+Choice\s*$/im)[1]
      ?.split(/^##\s/m)[0] ?? "";
  const namesOne = /\b(MCP|CLI)\b/.test(choice);
  const words = choice.split(/\s+/).filter(Boolean).length;
  return namesOne && words >= FEWEST_WORDS_IN_CHOICE;
}

export default [
  {
    says: "qa/runs/mcp.jsonl is a finished claude -p run that used the Playwright MCP browser",
    test: (folder) => usedMcpBrowser(readRun(folder, "mcp")),
    tryNext:
      "run the task with --output-format stream-json --verbose and save it as qa/runs/mcp.jsonl",
  },
  {
    says: "qa/runs/cli.jsonl is a finished claude -p run that used the Playwright CLI",
    test: (folder) =>
      usedCliBrowser(readRun(folder, "cli")) && !usedMcpBrowser(readRun(folder, "cli")),
    tryNext:
      "run the task again with only Bash(bunx playwright cli:*) allowed, saved as qa/runs/cli.jsonl",
  },
  {
    says: "tokens, turns, seconds and findings in qa/mcp-vs-cli.md match the two runs",
    test: numbersMatchTheRuns,
    tryNext: "ask Claude Code to read the result line of each run; never type a number yourself",
  },
  {
    says: "a Real findings row says how many findings you checked were real",
    test: realFindingsWereJudged,
    tryNext: "open each FINDING in the shop yourself and count only the true ones",
  },
  {
    says: "## Choice names MCP or CLI for the team, with a reason",
    test: choiceHasAReason,
    tryNext: "write which one the team will use for exploring, and the number that decided it",
  },
] satisfies Rule[];
