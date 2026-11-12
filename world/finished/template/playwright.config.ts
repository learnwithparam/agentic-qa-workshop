// Run the suite from this folder: bunx playwright test
// With BASE_URL set it uses that shop; otherwise it starts one on http://localhost:4173.
import { pantryConfig } from "../../../world/playwright.base";

export default pantryConfig("./tests");
