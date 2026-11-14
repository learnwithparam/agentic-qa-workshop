// The suite the previous tester left. Run it from this folder: bunx playwright test
// It starts the shop for you if one is not already running on http://localhost:4173.
// A failed run keeps its trace, so you can open it with: bunx playwright show-trace <trace.zip>
import { defineConfig } from "@playwright/test";
import { pantryConfig } from "../../../../world/playwright.base";

const base = pantryConfig("./tests");

export default defineConfig({
  ...base,
  use: { ...base.use, trace: "retain-on-failure" },
});
