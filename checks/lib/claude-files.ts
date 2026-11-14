// Small readers for the Claude Code files a learner keeps: settings, agents, skills, rules.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readText } from "./markdown";

export const lineCount = (path: string) => readText(path).split("\n").length;

// The text between the two --- lines at the top of a Markdown file, as key: value pairs.
export function frontmatter(markdown: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---/.exec(markdown);
  const found: Record<string, string> = {};
  for (const line of (match?.[1] ?? "").split("\n")) {
    const pair = /^([\w-]+):\s*(.*)$/.exec(line);
    if (pair) found[pair[1]] = pair[2].trim();
  }
  return found;
}

export function readSettings(folder: string): Record<string, unknown> {
  try {
    return JSON.parse(readText(join(folder, ".claude", "settings.json")));
  } catch {
    return {};
  }
}

export function markdownFilesIn(folder: string): string[] {
  if (!existsSync(folder)) return [];
  return readdirSync(folder)
    .filter((name) => name.endsWith(".md"))
    .map((name) => join(folder, name));
}

export const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

// The text under "## <name>", up to the next heading of level 2.
export function sectionOf(markdown: string, name: string): string {
  const parts = markdown.split(new RegExp(`^##\\s+${name}\\s*$`, "im"));
  return parts.length < 2 ? "" : parts[1].split(/^##\s/m)[0];
}

// The text after "- <label>:" in a bullet list, or "" when the label is missing.
export function labelled(markdown: string, label: string): string {
  const line = new RegExp(`^\\s*[-*]\\s+${label}:\\s*(.+)$`, "im").exec(markdown);
  return line?.[1].trim() ?? "";
}

export const readFile = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");
