// Finds a Chromium for Playwright.
// It tries CHROMIUM_PATH first, then Playwright's own download, then a copy on the system.
// On a fresh machine or a CI runner it installs the packages and Chromium first, once.
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
const SYSTEM = ["/opt/pw-browsers/chromium"];

// We hide the output of each install so a check prints only its own result.
const QUIET = { cwd: ROOT, stdout: "ignore", stderr: "ignore" } as const;

export function ensurePackages() {
  const playwrightFolder = join(ROOT, "node_modules", "@playwright", "test");
  if (!existsSync(playwrightFolder)) {
    Bun.spawnSync(["bun", "install", "--frozen-lockfile"], QUIET);
  }
}

// Asks the installed @playwright/test where its Chromium lives.
// It runs in a child process, so a package installed a moment ago is the one that answers.
function playwrightChromium(): string | null {
  ensurePackages();
  const askPlaywright = 'console.log(require("@playwright/test").chromium.executablePath())';
  const answer = Bun.spawnSync(["bun", "-e", askPlaywright], {
    cwd: ROOT,
    stdout: "pipe",
    stderr: "ignore",
  });
  const path = answer.stdout.toString().trim();
  if (answer.exitCode !== 0) return null;
  if (!path) return null;
  if (!existsSync(path)) return null;
  return path;
}

export function chromiumPath(): string | null {
  const pathFromEnvironment = process.env.CHROMIUM_PATH;
  if (pathFromEnvironment && existsSync(pathFromEnvironment)) return pathFromEnvironment;
  // An empty path means "Playwright already knows where its own Chromium is".
  if (playwrightChromium()) return "";
  for (const systemPath of SYSTEM) {
    if (existsSync(systemPath)) return systemPath;
  }
  return null;
}

function installChromium() {
  Bun.spawnSync(["bun", "x", "playwright", "install", "--with-deps", "chromium"], QUIET);
  // Installing system packages needs extra rights, so try again without them if it failed.
  if (chromiumPath() === null) {
    Bun.spawnSync(["bun", "x", "playwright", "install", "chromium"], QUIET);
  }
}

let triedToInstall = false;

// Returns the environment a Playwright run needs, installing Chromium once if nothing is found.
export function browserEnv(): Record<string, string> {
  let path = chromiumPath();
  if (path === null && !triedToInstall) {
    triedToInstall = true;
    installChromium();
    path = chromiumPath();
  }
  if (path === null) {
    throw new Error("No Chromium found. Run bun run setup, or set CHROMIUM_PATH in .env.");
  }
  if (!path) return {};
  // biome-ignore lint/style/useNamingConvention: environment variable names are uppercase
  return { CHROMIUM_PATH: path };
}
