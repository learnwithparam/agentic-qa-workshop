// Small Markdown readers for the files learners write: plans, reviews, notes.
import { existsSync, readFileSync } from "node:fs";

export const readText = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

export type Scenario = { title: string; covers: string[]; kind: string; body: string };

// A plan file: "## Scenario: <title>" headings, each with "Covers: ID, ID" and "Kind: happy | boundary | negative".
export function scenarios(md: string): Scenario[] {
  const parts = md.split(/^## Scenario:\s*/m).slice(1);
  return parts.map((p) => {
    const [first, ...rest] = p.split("\n");
    const body = rest.join("\n").split(/^## /m)[0];
    const covers = (body.match(/^\s*[-*]?\s*Covers:\s*(.+)$/im)?.[1] ?? "").split(/[,\s]+/).filter((x) => /^[A-Z]+-\d+$/.test(x));
    const kind = (body.match(/^\s*[-*]?\s*Kind:\s*(\w+)/im)?.[1] ?? "").toLowerCase();
    return { title: first.trim(), covers, kind, body };
  });
}

export function requirementIds(md: string): string[] {
  return [...new Set([...md.matchAll(/\|\s*([A-Z]+-\d+)\s*\|/g)].map((m) => m[1]))];
}
