// The suite the previous tester left. Run it from this folder: bunx playwright test
// It starts the shop for you if one is not already running on http://localhost:4173.
import { defineConfig } from "@playwright/test";
import { pantryConfig } from "../../../../../world/playwright.base";

// Flaky tests get two more tries, so a red run is rare.
export default defineConfig({ ...pantryConfig("./tests"), retries: 2 });
