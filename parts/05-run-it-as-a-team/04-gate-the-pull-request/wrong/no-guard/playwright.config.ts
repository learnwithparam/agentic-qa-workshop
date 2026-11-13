// Run the suite from this folder: bunx playwright test
// The gate sets TESTS_DIR to run a pull request's tests instead of this folder's own.
import { pantryConfig } from "../../../../../world/playwright.base";

export default pantryConfig(process.env.TESTS_DIR ?? "./tests");
