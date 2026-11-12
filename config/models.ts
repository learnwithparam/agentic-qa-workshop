// The only file that names a model. Code asks for a role (fast, smart, judge), never an id.
// Pick the provider with LLM_PROVIDER in .env: replay (default, no key), anthropic, openrouter, openai, ollama.
// Ids read from the providers' live lists on 12 Nov 2026 (curriculum briefs/MODELS.md).

export type Role = "fast" | "smart" | "judge";
export type Provider = "replay" | "anthropic" | "openrouter" | "openai" | "ollama";

export const PROVIDERS: Provider[] = ["replay", "anthropic", "openrouter", "openai", "ollama"];

export const MODELS: Record<Exclude<Provider, "replay">, Record<Role, string>> = {
  anthropic: { fast: "claude-haiku-5-5", smart: "claude-sonnet-5-5", judge: "claude-haiku-5-5" },
  openrouter: { fast: "nvidia/nemotron-3.5-lightning", smart: "anthropic/claude-sonnet-5.5", judge: "anthropic/claude-haiku-5.5" },
  openai: { fast: "gpt-6-luna", smart: "gpt-6-luna-pro", judge: "gpt-6-luna" },
  ollama: { fast: "qwen3:8b", smart: "qwen3:32b", judge: "qwen3:8b" },
};

// The key each live provider needs. Keys live in .env (git-ignored), never in code or output.
export const KEY_NAME: Record<Exclude<Provider, "replay">, string | null> = {
  anthropic: "ANTHROPIC_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  openai: "OPENAI_API_KEY",
  ollama: null,
};

export function provider(): Provider {
  const p = (process.env.LLM_PROVIDER ?? "replay").trim() as Provider;
  if (!PROVIDERS.includes(p)) throw new Error(`LLM_PROVIDER is "${p}". Use one of: ${PROVIDERS.join(", ")}.`);
  return p;
}

export function modelId(role: Role, p: Provider = provider()): string {
  return p === "replay" ? `replay:${role}` : MODELS[p][role];
}
