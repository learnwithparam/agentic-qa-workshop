// Reads a shop's event log. Checks judge what happened in the world, never what a model said.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Event = { type: string; at: string; [k: string]: unknown };
export function readEvents(dataDir: string): Event[] {
  const p = join(dataDir, "events.jsonl");
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}
