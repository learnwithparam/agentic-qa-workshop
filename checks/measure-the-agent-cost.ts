// measure-the-agent-cost: what did planning, generating and healing cost, and what did each kept
// test cost? The check reads the three claude -p results in qa/runs/, counts the tests that are
// still in tests/, and compares every number in qa/cost.md with them.
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Rule } from "../scripts/verify";
import { readText } from "./lib/markdown";
import { allTests } from "./lib/static";

const AGENTS = ["plan", "generate", "heal"] as const;
const TOKEN_PARTS = [
  "input_tokens",
  "output_tokens",
  "cache_creation_input_tokens",
  "cache_read_input_tokens",
];
// Money is written to the cent, so a number within half a cent is the same number.
const HALF_A_CENT = 0.0051;

type AgentRun = { tokens: number; minutes: number; cost: number };

function readAgentRun(folder: string, agent: string): AgentRun | null {
  const path = join(folder, "qa", "runs", `${agent}.json`);
  if (!existsSync(path)) return null;
  const result = JSON.parse(readFileSync(path, "utf8"));
  if (result.type !== "result" || !result.usage) return null;
  const usage = result.usage as Record<string, number>;
  const tokens = TOKEN_PARTS.reduce((total, part) => total + (usage[part] ?? 0), 0);
  const minutes = Math.round(Number(result.duration_ms) / 6000) / 10;
  return { tokens, minutes, cost: Number(result.total_cost_usd ?? 0) };
}

// Tests still in tests/, apart from the seed: the ones the team kept.
function keptTests(folder: string): number {
  const tests = allTests(join(folder, "tests"));
  return tests.filter((testCase) => basename(testCase.file) !== "seed.spec.ts").length;
}

function cellsOf(line: string): string[] {
  const cells = line.split("|").slice(1, -1);
  return cells.map((cell) => cell.trim());
}

// The table row whose first cell is this label, keyed by the header's lower-case names.
function tableRow(markdown: string, label: string): Record<string, number> {
  const allLines = markdown.split("\n");
  const tableLines = allLines.filter((line) => line.trim().startsWith("|"));
  const rows = tableLines.map(cellsOf);
  const header = rows.find((cells) => cells.some((cell) => /^tokens$/i.test(cell)));
  const row = rows.find((cells) => cells[0]?.toLowerCase() === label);
  if (!header || !row) return {};
  const values: Record<string, number> = {};
  for (let column = 1; column < header.length; column++) {
    const cell = (row[column] ?? "").replace(/[,$\s]/g, "");
    if (cell !== "") values[header[column].toLowerCase()] = Number(cell);
  }
  return values;
}

const costPage = (folder: string) => readText(join(folder, "qa", "cost.md"));

// A line like "Kept tests: 21" or "Cost per kept test: $0.08".
function labelledNumber(markdown: string, label: string): number | null {
  const pattern = new RegExp(`${label}:\\s*\\$?([\\d.,]+)`, "i");
  const found = markdown.match(pattern)?.[1];
  return found ? Number(found.replace(/,/g, "")) : null;
}

function agentRowMatches(markdown: string, agent: string, run: AgentRun): boolean {
  const row = tableRow(markdown, agent);
  const costMatches = Math.abs((row["cost (usd)"] ?? -1) - run.cost) <= HALF_A_CENT;
  const matches = row.tokens === run.tokens && row.minutes === run.minutes && costMatches;
  if (!matches) {
    console.log(
      `        ${agent}: the run says ${run.tokens} tokens, ${run.minutes} min, $${run.cost}`,
    );
  }
  return matches;
}

function everyRowMatches(folder: string): boolean {
  const markdown = costPage(folder);
  return AGENTS.every((agent) => {
    const run = readAgentRun(folder, agent);
    return run !== null && agentRowMatches(markdown, agent, run);
  });
}

function costPerKeptTestIsRight(folder: string): boolean {
  const runs = AGENTS.map((agent) => readAgentRun(folder, agent));
  const kept = keptTests(folder);
  if (runs.some((run) => run === null) || kept === 0) return false;
  const totalCost = runs.reduce((total, run) => total + (run?.cost ?? 0), 0);
  const written = labelledNumber(costPage(folder), "Cost per kept test");
  return written !== null && Math.abs(written - totalCost / kept) <= HALF_A_CENT;
}

export default [
  {
    says: "qa/runs/ has the claude -p results for plan, generate and heal",
    test: (folder) => AGENTS.every((agent) => readAgentRun(folder, agent) !== null),
    tryNext: "run each agent with claude -p --output-format json and save it in qa/runs/",
  },
  {
    says: "the plan, generate and heal rows in qa/cost.md match the three runs",
    test: everyRowMatches,
    tryNext: "ask Claude Code to copy tokens, minutes and cost from each run's result",
  },
  {
    says: "Kept tests in qa/cost.md is the number of tests in tests/, apart from the seed",
    test: (folder) => labelledNumber(costPage(folder), "Kept tests") === keptTests(folder),
    tryNext: "count the tests that are still in tests/ now, not the tests the agent wrote",
  },
  {
    says: "Cost per kept test is the total cost of the three runs over the kept tests",
    test: costPerKeptTestIsRight,
    tryNext: "add the three costs, divide by Kept tests, and round to the cent",
  },
] satisfies Rule[];
