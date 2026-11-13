// Run your repro tests from this folder: bunx playwright test
// It starts the shop for you if one is not already running on http://localhost:4173.
import { pantryConfig } from "../../../../../world/playwright.base";

export default pantryConfig("./qa/explore");
