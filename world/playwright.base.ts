// The Playwright settings every suite in this course uses. A suite's own playwright.config.ts calls
// pantryConfig("./tests"). Tests share one shop and reset it, so they run one at a time.
import { defineConfig } from "@playwright/test";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

export function pantryConfig(testDir: string) {
  const external = Boolean(process.env.BASE_URL);
  return defineConfig({
    testDir,
    testMatch: /.*\.spec\.ts$/,
    timeout: 15_000,
    expect: { timeout: 4_000 },
    workers: 1,
    fullyParallel: false,
    retries: 0,
    reporter: process.env.PW_JSON ? [["json", { outputFile: process.env.PW_JSON }]] : [["list"]],
    outputDir: process.env.PW_OUT ?? join(ROOT, ".runs", "test-results"),
    use: {
      baseURL: process.env.BASE_URL ?? "http://localhost:4173",
      launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
      trace: "off",
      actionTimeout: 5_000,
      navigationTimeout: 10_000,
    },
    webServer: external ? undefined : {
      command: "bun world/cli.ts shop",
      cwd: ROOT,
      url: "http://localhost:4173/health",
      reuseExistingServer: true,
      timeout: 20_000,
    },
  });
}
