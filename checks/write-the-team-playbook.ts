// write-the-team-playbook: the team's rules for agent work, in qa/playbook.md.
// The check reads the four sections. Every number the team reports must be one the gate or the
// cost step computes (qa/scorecard.json and qa/cost.md), and none may be a count of tests written.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { readText } from "./lib/markdown";

const SECTIONS = ["Agents may", "Agents may not", "Human gates", "Numbers we report"];
const FEWEST_NUMBERS = 4;
const COST_NUMBER = "cost per kept test";
const WEAKENING_WORDS = /\b(expect|assert|assertion|expected value)/i;
const SKIPPING_WORDS = /\b(skip|fixme|retr(y|ies))/i;
const PERSON_WORDS =
  /\b(lead|reviewer|engineer|owner|tester|developer|sdet|person|human|manager)\b/i;
const VANITY_NUMBERS =
  /\b(tests? (written|generated|created)|lines of|number of tests|test count)\b/i;

// The text under "## <name>", up to the next heading of level 2.
function section(markdown: string, name: string): string {
  const parts = markdown.split(new RegExp(`^##\\s+${name}\\s*$`, "im"));
  if (parts.length < 2) return "";
  return parts[1].split(/^##\s/m)[0];
}

function bullets(text: string): string[] {
  const lines = text.split("\n");
  const bulletLines = lines.filter((line) => /^\s*[-*]\s+\S/.test(line));
  return bulletLines.map((line) => line.replace(/^\s*[-*]\s+/, ""));
}

const playbook = (folder: string) => readText(join(folder, "qa", "playbook.md"));
const bulletsIn = (folder: string, name: string) => bullets(section(playbook(folder), name));

// The numbers the team can report: the gate's scorecard, and the cost step's cost per kept test.
function computedNumbers(folder: string): string[] {
  const scorecardPath = join(folder, "qa", "scorecard.json");
  const names = [COST_NUMBER];
  if (existsSync(scorecardPath)) {
    const scorecard = JSON.parse(readFileSync(scorecardPath, "utf8"));
    names.push(...Object.keys(scorecard));
  }
  return names.map((name) => name.toLowerCase());
}

function everySectionHasRules(folder: string): boolean {
  return SECTIONS.every((name) => bulletsIn(folder, name).length >= 2);
}

function forbidsWeakeningTests(folder: string): boolean {
  const rules = bulletsIn(folder, "Agents may not");
  const forbidsWeakening = rules.some((rule) => WEAKENING_WORDS.test(rule));
  const forbidsSkipping = rules.some((rule) => SKIPPING_WORDS.test(rule));
  return forbidsWeakening && forbidsSkipping;
}

function everyGateNamesPerson(folder: string): boolean {
  const gates = bulletsIn(folder, "Human gates");
  return gates.length >= 2 && gates.every((gate) => PERSON_WORDS.test(gate));
}

function reportsComputedNumbers(folder: string): boolean {
  const reported = bulletsIn(folder, "Numbers we report");
  const known = computedNumbers(folder);
  const isComputed = (line: string) => known.some((name) => line.toLowerCase().includes(name));
  return reported.length >= FEWEST_NUMBERS && reported.every(isComputed);
}

function reportsNoVanityNumber(folder: string): boolean {
  const reported = bulletsIn(folder, "Numbers we report");
  return reported.length > 0 && !reported.some((line) => VANITY_NUMBERS.test(line));
}

export default [
  {
    says: "qa/playbook.md has Agents may, Agents may not, Human gates and Numbers we report",
    test: everySectionHasRules,
    tryNext: "ask Claude Code for the four ## sections, each with at least two bullet rules",
  },
  {
    says: "Agents may not forbids weakening an expect and skipping a test",
    test: forbidsWeakeningTests,
    tryNext: "add a rule against changing or removing an expect, and one against skip or fixme",
  },
  {
    says: "every human gate names who approves",
    test: everyGateNamesPerson,
    tryNext: "write who signs off each gate, such as the QA lead or the reviewer",
  },
  {
    says: "at least 4 numbers, each one the gate or the cost step computes",
    test: reportsComputedNumbers,
    tryNext: "name the numbers in qa/scorecard.json and the cost per kept test, word for word",
  },
  {
    says: "no number counts tests written by an agent",
    test: reportsNoVanityNumber,
    tryNext:
      "remove the count of tests written: it goes up when the suite gets worse, just as when it gets better",
  },
] satisfies Rule[];
