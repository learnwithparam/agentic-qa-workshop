// gate-the-pull-request: the learner's gate must merge the clean pull request and block the four
// planted bad ones: an agent that removed an assertion, a test that catches nothing, a flaky test,
// and a mutation score below the break threshold. The check runs bun run gate on each one, in
// the learner's folder, and reads only the exit code.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../scripts/structure";
import type { Rule } from "../scripts/verify";
import { browserEnv } from "./lib/browser";
import { readText } from "./lib/markdown";
import { once } from "./lib/memo";
import { withShop } from "./lib/world";

const PULLS = join(ROOT, "parts", "05-run-it-as-a-team", "04-gate-the-pull-request", "pulls");
const GATE_TIMEOUT = 300_000;

type GateRun = { merged: boolean; output: string };

// Runs the gate on one pull request. A gate that only reads BASE_URL gets a fixed shop.
function runGate(folder: string, pull: string): Promise<GateRun> {
  return once(`gate-${pull}`, folder, () =>
    withShop({ bugs: "none" }, async (shop) => {
      // biome-ignore lint/style/useNamingConvention: environment variable names are uppercase
      const environment = { ...process.env, ...browserEnv(), BASE_URL: shop.url, CI: "1" };
      const child = Bun.spawn(["bun", "run", "gate", join(PULLS, pull)], {
        cwd: folder,
        env: environment,
        stdout: "pipe",
        stderr: "pipe",
      });
      const timer = setTimeout(() => child.kill(), GATE_TIMEOUT);
      const output = await new Response(child.stdout).text();
      const exitCode = await child.exited;
      clearTimeout(timer);
      return { merged: exitCode === 0, output };
    }),
  );
}

function hasGateScript(folder: string): boolean {
  const packagePath = join(folder, "package.json");
  if (!existsSync(packagePath)) return false;
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  return typeof packageJson.scripts?.gate === "string";
}

function ciRunsTheGate(folder: string): boolean {
  const workflow = readText(join(folder, "ci", "pull-request.yml"));
  return /\bpull_request\b/.test(workflow) && /bun run gate\b/.test(workflow);
}

const policyPath = (folder: string) => join(folder, "qa", "flake-policy.json");

type QuarantineEntry = { test?: string; owner?: string; reason?: string; expires?: string };
type FlakePolicy = { retries?: number; maxQuarantined?: number; quarantine?: QuarantineEntry[] };

function readPolicy(folder: string): FlakePolicy | null {
  try {
    return JSON.parse(readText(policyPath(folder))) as FlakePolicy;
  } catch {
    return null;
  }
}

const filled = (text: string | undefined) => (text ?? "").trim().length > 0;
const isDate = (text: string | undefined) => /^\d{4}-\d{2}-\d{2}$/.test(text ?? "");

// A quarantined test needs a person who owns it and a day it must be fixed or deleted.
function quarantineIsOwned(folder: string): boolean {
  const policy = readPolicy(folder);
  if (!policy || !Array.isArray(policy.quarantine)) return false;
  const owned = (entry: QuarantineEntry) =>
    filled(entry.test) && filled(entry.owner) && filled(entry.reason) && isDate(entry.expires);
  return policy.quarantine.every(owned);
}

// The list may not grow without limit, and a retry may not stand in for a fix.
function quarantineHasALimit(folder: string): boolean {
  const policy = readPolicy(folder);
  if (!policy || !Array.isArray(policy.quarantine)) return false;
  const limit = policy.maxQuarantined;
  return typeof limit === "number" && limit > 0 && policy.quarantine.length <= limit
    && (policy.retries ?? 0) === 0;
}

function ciShardsTheSuite(folder: string): boolean {
  const workflow = readText(join(folder, "ci", "pull-request.yml"));
  return /\bmatrix:/.test(workflow) && /--shard=\$\{\{\s*matrix\.shard\s*\}\}\/\d+/.test(workflow);
}

function ciKeepsTraces(folder: string): boolean {
  const workflow = readText(join(folder, "ci", "pull-request.yml"));
  const uploads = /actions\/upload-artifact@/.test(workflow);
  const onFailure = /if:\s*(failure\(\)|always\(\))/.test(workflow);
  return uploads && onFailure && /test-results|playwright-report/.test(workflow);
}

function ciSkipsQuarantine(folder: string): boolean {
  const workflow = readText(join(folder, "ci", "pull-request.yml"));
  return /--grep-invert\s+@quarantine/.test(workflow);
}

const merges = (pull: string) => async (folder: string) => (await runGate(folder, pull)).merged;

const blocks = (pull: string) => async (folder: string) => {
  if (!hasGateScript(folder)) return false;
  const run = await runGate(folder, pull);
  return !run.merged;
};

export default [
  {
    says: "ci/pull-request.yml runs bun run gate on every pull request",
    test: (folder) => hasGateScript(folder) && ciRunsTheGate(folder),
    tryNext: "ask Claude Code for a workflow that runs on pull_request and calls bun run gate",
  },
  {
    says: "the gate merges the clean pull request",
    test: merges("clean-pull"),
    tryNext: "run bun run gate ../pulls/clean-pull and read the first BLOCKED line",
  },
  {
    says: "the gate blocks the pull request where an agent removed an expect",
    test: blocks("removes-an-expect"),
    tryNext: "run qa/guard.ts on the diff of every test file between tests/ and the pull's tests/",
  },
  {
    says: "the gate blocks the pull request whose new test catches no planted bug",
    test: blocks("catches-nothing"),
    tryNext: "run each new test with each requirement bug on; a new test must go red at least once",
  },
  {
    says: "the gate blocks the pull request with a flaky test",
    test: blocks("flaky-test"),
    tryNext: "run the new tests 10 times in a row on one shop with --repeat-each=10",
  },
  {
    says: "the gate blocks the pull request whose mutation score is under the break threshold",
    test: blocks("mutation-drop"),
    tryNext: "read reports/mutation/mutation.json and compare the score with thresholds.break",
  },
  {
    says: "ci/pull-request.yml splits the suite into shards that run side by side",
    test: ciShardsTheSuite,
    tryNext: "add a matrix of shard numbers and run playwright test with --shard=N/4",
  },
  {
    says: "a red run uploads its trace and report as a CI artefact",
    test: ciKeepsTraces,
    tryNext: "add an upload-artifact step with if: failure() for playwright-report and test-results",
  },
  {
    says: "qa/flake-policy.json gives every quarantined test an owner, a reason and an end date",
    test: quarantineIsOwned,
    tryNext: "add test, owner, reason and expires (YYYY-MM-DD) to each quarantine entry",
  },
  {
    says: "the quarantine has a size limit and the policy allows no retries",
    test: quarantineHasALimit,
    tryNext: "set maxQuarantined above zero, keep the list within it, and keep retries at 0",
  },
  {
    says: "the sharded job leaves quarantined tests out with --grep-invert @quarantine",
    test: ciSkipsQuarantine,
    tryNext: "tag quarantined tests @quarantine and skip that tag in the sharded job",
  },
] satisfies Rule[];
