// bun run gate <pull-folder>: decides if a pull request may merge.
// Today it only runs the pull request's tests once against the shop. Green means merge.
import { resolve } from "node:path";

const pullFolder = process.argv[2];
if (!pullFolder) {
  console.log("Name a pull request folder: bun run gate ../pulls/clean-pull");
  process.exit(1);
}
// biome-ignore lint/style/useNamingConvention: environment variable names are uppercase
const environment = { ...process.env, TESTS_DIR: resolve(pullFolder, "tests") };
const run = Bun.spawnSync(["bun", "x", "playwright", "test"], {
  env: environment,
  stdout: "inherit",
});
if (run.exitCode === 0) {
  console.log("MERGE: the tests pass.");
} else {
  console.log("BLOCKED: a test failed.");
}
process.exit(run.exitCode === 0 ? 0 : 1);
