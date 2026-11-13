// bun parts/04-test-beyond-the-ui/images/shots.ts: takes the pictures this part's READMEs show.
// Terminal pictures are the real output of the check on each sample solution, drawn as a dark
// terminal. The exploring picture is the real shop with the double-book bug on.
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { browserEnv } from "../../../checks/lib/browser";
import { withShop } from "../../../checks/lib/world";
import { ROOT } from "../../../scripts/structure";

const PART = join(ROOT, "parts", "04-test-beyond-the-ui");
const picture = (stepFolder: string) => join(PART, stepFolder, "images", "expected.png");

const environment = browserEnv();
const launchOptions = environment.CHROMIUM_PATH
  ? { executablePath: environment.CHROMIUM_PATH }
  : {};
const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({ deviceScaleFactor: 2 });

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function colourLine(line: string): string {
  const safe = escapeHtml(line);
  const good = safe.replace(/\b(PASS|Done)\b/g, '<span style="color:#5fd38d">$1</span>');
  return good.replace(/\b(FAIL)\b/g, '<span style="color:#ff7a6b">$1</span>');
}

async function terminal(command: string, output: string, file: string) {
  const body = output.split("\n").map(colourLine).join("\n");
  const style = [
    "width:800px",
    "padding:18px 20px",
    "box-sizing:border-box",
    "font:13px/1.5 ui-monospace,Menlo,Consolas,monospace",
    "color:#d6e2dc",
    "background:#0f1412",
  ].join(";");
  const prompt = `<div style="color:#7fa391;margin-bottom:6px">$ ${escapeHtml(command)}</div>`;
  const outputBlock = `<pre style="margin:0;white-space:pre-wrap">${body}</pre>`;
  const html = `<body style="margin:0"><div style="${style}">${prompt}${outputBlock}</div></body>`;
  await page.setViewportSize({ width: 820, height: 200 });
  await page.setContent(html);
  await page.locator("div").first().screenshot({ path: file });
}

// The check's output on the sample solution, as a learner sees it once their work passes.
async function checkPicture(stepName: string, stepFolder: string) {
  const run = Bun.spawnSync(["bun", "scripts/verify.ts", stepName, "solution"], {
    cwd: ROOT,
    env: { ...process.env, ...environment },
  });
  const output = run.stdout.toString().trim().replace("(sample solution)", "(your work)");
  await terminal(`bun run verify ${stepName}`, output, picture(stepFolder));
}

async function signIn(shopPage: Page, shopUrl: string) {
  await shopPage.goto(`${shopUrl}/signin`);
  await shopPage.getByLabel("Email").fill("ana@pantryrun.test");
  await shopPage.getByLabel("Password").fill("pantry");
  await shopPage.getByRole("button", { name: "Sign in" }).click();
}

// What the agent sees when it double clicks Book slot: two slots held, the fee charged twice.
async function doubleBookPicture() {
  await withShop({ bugs: "double-book" }, async (shop) => {
    await page.setViewportSize({ width: 1000, height: 700 });
    await signIn(page, shop.url);
    await page.goto(`${shop.url}/slots`);
    await page.getByRole("radio", { name: /Mar 12 09:00/ }).check();
    await page.getByRole("button", { name: "Book slot" }).dblclick();
    await page.waitForURL(/basket/);
    await page.waitForLoadState("networkidle");
    await page.reload();
    await page.screenshot({ path: picture("02-explore-with-an-agent"), fullPage: true });
  });
}

await checkPicture("test-the-order-api-contract", "01-test-the-order-api-contract");
await doubleBookPicture();
await checkPicture("test-the-substitution-suggester", "03-test-the-substitution-suggester");
await browser.close();
console.log("Took 3 pictures for Part 4.");
