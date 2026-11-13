// Small Markdown readers for the files learners write: plans, reviews, notes.
import { existsSync, readFileSync } from "node:fs";

export const readText = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");

export type Scenario = { title: string; covers: string[]; kind: string; body: string };

type OpenScenario = { title: string; body: string[] };

// A scenario heading is either "## Scenario: <title>"
// or the Playwright planner's "#### 1.2 <title>".
const HEADING = /^(?:#{2,4}\s+Scenario:\s*|####\s+\d+(?:\.\d+)*\.?\s+)(.+)$/;

// Any heading of level 1 to 3 ends the scenario before it.
const BIGGER_HEADING = /^#{1,3}\s/;

const REQUIREMENT_ID = /^[A-Z]+-\d+$/;

const removeBold = (text: string) => text.replace(/\*\*/g, "");

// Reads "Covers: ID, ID" from a scenario body and keeps only the requirement ids.
function coveredIds(body: string): string[] {
  const coversLine = body.match(/^\s*[-*]?\s*Covers:\s*(.+)$/im)?.[1] ?? "";
  const words = coversLine.split(/[,\s]+/);
  return words.filter((word) => REQUIREMENT_ID.test(word));
}

// Reads "Kind: happy | boundary | negative" from a scenario body.
function scenarioKind(body: string): string {
  const kind = body.match(/^\s*[-*]?\s*Kind:\s*(\w+)/im)?.[1] ?? "";
  return kind.toLowerCase();
}

function finishScenario(open: OpenScenario): Scenario {
  const body = removeBold(open.body.join("\n"));
  return { title: open.title, covers: coveredIds(body), kind: scenarioKind(body), body };
}

// Reads one line and returns the scenario that is open after it.
// A finished scenario is added to "found".
function readLine(
  line: string,
  current: OpenScenario | null,
  found: Scenario[],
): OpenScenario | null {
  const heading = HEADING.exec(line);
  const endsScenario = heading !== null || BIGGER_HEADING.test(line);
  if (current && endsScenario) found.push(finishScenario(current));
  if (heading) return { title: removeBold(heading[1]).trim(), body: [] };
  if (endsScenario) return null;
  current?.body.push(line);
  return current;
}

// Each scenario carries "Covers: ID, ID" and "Kind: happy | boundary | negative".
// Bold markers are fine.
export function scenarios(markdown: string): Scenario[] {
  const found: Scenario[] = [];
  let current: OpenScenario | null = null;
  for (const line of markdown.split("\n")) {
    current = readLine(line, current, found);
  }
  if (current) found.push(finishScenario(current));
  return found;
}

// Reads every requirement id that sits alone in a Markdown table cell, like "| SLOT-1 |".
export function requirementIds(markdown: string): string[] {
  const matches = [...markdown.matchAll(/\|\s*([A-Z]+-\d+)\s*\|/g)];
  const ids = matches.map((match) => match[1]);
  return [...new Set(ids)];
}

// Makes two texts easy to compare: lower case, and only letters, digits and single spaces.
export const norm = (text: string) => {
  const lowerCase = text.toLowerCase();
  return lowerCase.replace(/[^a-z0-9]+/g, " ").trim();
};
