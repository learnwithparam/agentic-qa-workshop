// The finished suite. Run it with: bunx playwright test --config reference/playwright.config.ts
import { pantryConfig } from "../world/playwright.base";

export default pantryConfig("./tests");
