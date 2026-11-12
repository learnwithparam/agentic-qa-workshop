// One call path for every model call in the course. Replay mode answers from recorded replies, so the
// shop, the checks and CI run with no key. Live modes use the Vercel AI SDK providers.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateText, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { KEY_NAME, modelId, provider, type Provider, type Role } from "./models";

export const REPLAY_FILE = join(import.meta.dir, "..", "world", "replay", "replies.json");
export type Reply = { text: string; provider: Provider; role: Role; inputTokens: number; outputTokens: number };

export class ReplayMiss extends Error {}

export const replayKey = (role: Role, prompt: string, seed: number) =>
  createHash("sha256").update(`${role}\n${seed}\n${prompt}`).digest("hex").slice(0, 20);

let replies: Record<string, string> | null = null;
function loadReplies(): Record<string, string> {
  if (!replies) replies = existsSync(REPLAY_FILE) ? JSON.parse(readFileSync(REPLAY_FILE, "utf8")) : {};
  return replies!;
}

function liveModel(role: Role, p: Exclude<Provider, "replay">): LanguageModel {
  const keyName = KEY_NAME[p];
  if (keyName && !process.env[keyName]) throw new Error(`LLM_PROVIDER is ${p} but ${keyName} is not set. Add it to .env (see .env.example).`);
  const id = modelId(role, p);
  if (p === "anthropic") return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(id);
  if (p === "openai") return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(id);
  if (p === "openrouter") return createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })(id);
  return createOpenAI({ baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1", apiKey: "ollama" })(id);
}

export async function complete(role: Role, prompt: string, opts: { seed?: number; record?: boolean } = {}): Promise<Reply> {
  const p = provider();
  const seed = opts.seed ?? 0;
  if (p === "replay") {
    const text = loadReplies()[replayKey(role, prompt, seed)];
    if (text === undefined) throw new ReplayMiss("No recorded reply for this request. Replay mode only answers the requests the course recorded.");
    return { text, provider: p, role, inputTokens: 0, outputTokens: 0 };
  }
  const r = await generateText({ model: liveModel(role, p), prompt, maxOutputTokens: 400 });
  if (opts.record) {
    const all = loadReplies();
    all[replayKey(role, prompt, seed)] = r.text;
    writeFileSync(REPLAY_FILE, JSON.stringify(all, null, 0) + "\n");
  }
  return { text: r.text, provider: p, role, inputTokens: r.usage.inputTokens ?? 0, outputTokens: r.usage.outputTokens ?? 0 };
}
