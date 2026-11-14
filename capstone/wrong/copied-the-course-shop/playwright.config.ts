// Point this at your own app: APP_URL=https://my-app.example bunx playwright test
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // biome-ignore lint/style/useNamingConvention: baseURL is the name Playwright reads
  use: { baseURL: process.env.APP_URL, trace: "retain-on-failure" },
});
