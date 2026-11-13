// Reads a shop's event log. Checks judge what happened in the world, never what a model said.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Event = { type: string; at: string; [field: string]: unknown };

export function readEvents(dataDir: string): Event[] {
  const logPath = join(dataDir, "events.jsonl");
  if (!existsSync(logPath)) return [];
  const lines = readFileSync(logPath, "utf8").split("\n");
  const filledLines = lines.filter(Boolean);
  return filledLines.map((line) => JSON.parse(line));
}
