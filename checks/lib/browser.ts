// Finds a Chromium for Playwright: CHROMIUM_PATH, then Playwright's own download, then a system copy.
import { existsSync } from "node:fs";
import { chromium } from "@playwright/test";

const SYSTEM = ["/opt/pw-browsers/chromium"];

export function chromiumPath(): string | null {
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
  try {
    const own = chromium.executablePath();
    if (own && existsSync(own)) return "";
  } catch {}
  for (const p of SYSTEM) if (existsSync(p)) return p;
  return null;
}

let installed = false;
// Returns the env a Playwright run needs, installing Chromium once if nothing is found.
export function browserEnv(): Record<string, string> {
  let p = chromiumPath();
  if (p === null && !installed) {
    installed = true;
    Bun.spawnSync(["bunx", "playwright", "install", "chromium"], { stdout: "ignore", stderr: "ignore" });
    p = chromiumPath();
  }
  if (p === null) throw new Error("No Chromium found. Run bun run setup, or set CHROMIUM_PATH in .env.");
  return p ? { CHROMIUM_PATH: p } : {};
}
