// Small Markdown readers for the files learners write: plans, reviews, notes.
import { existsSync, readFileSync } from "node:fs";

export const readText = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

export type Scenario = { title: string; covers: string[]; kind: string; body: string };

// A scenario heading is either "## Scenario: <title>" or the Playwright planner's "#### 1.2 <title>".
const HEADING = /^(?:#{2,4}\s+Scenario:\s*|####\s+\d+(?:\.\d+)*\.?\s+)(.+)$/;

// Each scenario carries "Covers: ID, ID" and "Kind: happy | boundary | negative". Bold markers are fine.
export function scenarios(md: string): Scenario[] {
  const lines = md.split("\n");
  const out: Scenario[] = [];
  let cur: { title: string; body: string[] } | null = null;
  const flush = () => {
    if (!cur) return;
    const body = cur.body.join("\n").replace(/\*\*/g, "");
    const covers = (body.match(/^\s*[-*]?\s*Covers:\s*(.+)$/im)?.[1] ?? "").split(/[,\s]+/).filter((x) => /^[A-Z]+-\d+$/.test(x));
    const kind = (body.match(/^\s*[-*]?\s*Kind:\s*(\w+)/im)?.[1] ?? "").toLowerCase();
    out.push({ title: cur.title, covers, kind, body });
  };
  for (const l of lines) {
    const m = HEADING.exec(l);
    if (m) { flush(); cur = { title: m[1].replace(/\*\*/g, "").trim(), body: [] }; }
    else if (/^#{1,3}\s/.test(l) && cur) { flush(); cur = null; }
    else if (cur) cur.body.push(l);
  }
  flush();
  return out;
}

export function requirementIds(md: string): string[] {
  return [...new Set([...md.matchAll(/\|\s*([A-Z]+-\d+)\s*\|/g)].map((m) => m[1]))];
}

export const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
