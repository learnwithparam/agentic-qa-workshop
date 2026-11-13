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
] satisfies Rule[];
