// bun run text-audit: the 10 text checks from e2e/ on a shop with no bugs switched on.
// It starts its own shop on a free port with its own data folder, and stops it when done.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "./structure";

const PORT = process.env.AUDIT_PORT ?? "4179";
const dataDir = mkdtempSync(join(tmpdir(), "pantry-audit-"));
const env = {
  ...process.env,
  // biome-ignore lint/style/useNamingConvention: environment variable names
  AUDIT_URL: `http://localhost:${PORT}`,
  // biome-ignore lint/style/useNamingConvention: environment variable names
  AUDIT_SERVER: `cd ${ROOT} && PORT=${PORT} BUGS=none PANTRY_DATA=${dataDir} bun world/cli.ts shop`,
};
const run = Bun.spawn(
  ["bunx", "playwright", "test", "-c", "e2e/playwright.config.ts", ...process.argv.slice(2)],
  { cwd: ROOT, env, stdout: "inherit", stderr: "inherit" },
);
const code = await run.exited;
rmSync(dataDir, { recursive: true, force: true });
process.exit(code);
