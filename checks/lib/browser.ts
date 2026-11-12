// Finds a Chromium for Playwright: CHROMIUM_PATH, then Playwright's own download, then a system copy.
// On a fresh machine or a CI runner it installs the packages and Chromium first, once.
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
const SYSTEM = ["/opt/pw-browsers/chromium"];

function ensurePackages() {
  if (!existsSync(join(ROOT, "node_modules", "@playwright", "test"))) {
    Bun.spawnSync(["bun", "install", "--frozen-lockfile"], { cwd: ROOT, stdout: "ignore", stderr: "ignore" });
  }
}

function playwrightChromium(): string | null {
  ensurePackages();
  try {
    const { chromium } = require(join(ROOT, "node_modules", "@playwright", "test"));
    const p: string = chromium.executablePath();
    return p && existsSync(p) ? p : null;
  } catch {
    return null;
  }
}

export function chromiumPath(): string | null {
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
  if (playwrightChromium()) return "";
  for (const p of SYSTEM) if (existsSync(p)) return p;
  return null;
}

let tried = false;
// Returns the env a Playwright run needs, installing Chromium once if nothing is found.
export function browserEnv(): Record<string, string> {
  let p = chromiumPath();
  if (p === null && !tried) {
    tried = true;
    Bun.spawnSync(["bun", "x", "playwright", "install", "--with-deps", "chromium"], { cwd: ROOT, stdout: "ignore", stderr: "ignore" });
    if (chromiumPath() === null) Bun.spawnSync(["bun", "x", "playwright", "install", "chromium"], { cwd: ROOT, stdout: "ignore", stderr: "ignore" });
    p = chromiumPath();
  }
  if (p === null) throw new Error("No Chromium found. Run bun run setup, or set CHROMIUM_PATH in .env.");
  return p ? { CHROMIUM_PATH: p } : {};
}
