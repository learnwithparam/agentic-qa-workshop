// The config the checker runs a learner's tests with.
// It ignores the learner's own config on purpose, so a check always runs the same way:
// TESTS_DIR names the tests, BASE_URL names the shop.
import { pantryConfig } from "../../world/playwright.base";

export default pantryConfig(process.env.TESTS_DIR ?? "tests");
