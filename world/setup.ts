// bun run setup: checks Bun, makes sure Playwright has a Chromium, and seeds the shop.
import pw from "@playwright/test/package.json";
import { browserEnv } from "../checks/lib/browser";
import { reset } from "./store";

const [major, minor] = Bun.version.split(".").map(Number);
if (major < 1 || (major === 1 && minor < 4)) {
  console.log(
    `Bun ${Bun.version} is too old. Install Bun 1.4 or newer from bun.sh, then run bun run setup again.`,
  );
  process.exit(1);
}
let browser = "Chromium installed";
try {
  const env = browserEnv();
  if (env.CHROMIUM_PATH) browser = `Chromium at ${env.CHROMIUM_PATH}`;
} catch (e) {
  console.log((e as Error).message);
  process.exit(1);
}
reset();
console.log(`Ready: Bun ${Bun.version}, Playwright ${pw.version}, ${browser}. Shop data seeded.`);
