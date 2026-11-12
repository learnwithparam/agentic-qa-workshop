// The shop's stand-in model. The substitution suggester is a product feature of Pantry Run, not something the
// course asks you to build, so it never calls a real model: it answers from replies.json, written by make.ts.
// The same prompt and seed always give the same reply, so tests over 20 seeds are repeatable and free.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const REPLAY_FILE = join(import.meta.dir, "replies.json");

export class ReplayMiss extends Error {}

export const replayKey = (prompt: string, seed: number) =>
  createHash("sha256").update(`${seed}\n${prompt}`).digest("hex").slice(0, 20);

let replies: Record<string, string> | null = null;
function load(): Record<string, string> {
  if (!replies) replies = existsSync(REPLAY_FILE) ? JSON.parse(readFileSync(REPLAY_FILE, "utf8")) : {};
  return replies!;
}

export function reply(prompt: string, seed: number): string {
  const text = load()[replayKey(prompt, seed)];
  if (text === undefined) throw new ReplayMiss("No recorded reply for this request. The suggester only answers the seeds and shoppers the course recorded.");
  return text;
}
