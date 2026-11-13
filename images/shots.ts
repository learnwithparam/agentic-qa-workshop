// bun run shots: captures every picture the READMEs show, from the real shop and real command
// output. Pages are screenshots of a private shop. Terminal output is rendered as a dark
// terminal and screenshotted.

import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { browserEnv } from "../checks/lib/browser";
import { startShop } from "../checks/lib/world";
import { ROOT } from "../scripts/structure";

const PART_ONE = join(ROOT, "parts", "01-write-tests-with-agents");
const PICTURES = {
  board: join(ROOT, "images", "finished-system.png"),
  finished: join(ROOT, "images", "finished-claude-code.png"),
  shop: join(ROOT, "images", "shop.png"),
  orientBoard: join(ROOT, "00-orientation", "images", "goal-board.png"),
  orientShop: join(ROOT, "00-orientation", "images", "shop.png"),
  order: join(ROOT, "00-orientation", "meet-the-shop", "images", "expected.png"),
  seed: join(PART_ONE, "01-write-the-seed-test", "images", "expected.png"),
  report: join(PART_ONE, "03-generate-tests-from-the-plan", "images", "expected.png"),
};
for (const picture of Object.values(PICTURES)) mkdirSync(dirname(picture), { recursive: true });

// With a name on the command line, only that picture is taken.
const only = process.argv[2];
const env = browserEnv();
const launchOptions = env.CHROMIUM_PATH ? { executablePath: env.CHROMIUM_PATH } : {};
const browser = await chromium.launch(launchOptions);
const browserContext = await browser.newContext({
  viewport: { width: 1100, height: 760 },
  deviceScaleFactor: 2,
});
const page = await browserContext.newPage();

function wanted(pictureName: string): boolean {
  return !only || only === pictureName;
}

function escapeHtml(text: string): string {
  const withAmpersands = text.replace(/&/g, "&amp;");
  const withLessThan = withAmpersands.replace(/</g, "&lt;");
  return withLessThan.replace(/>/g, "&gt;");
}

// Colours the words that mean good news green and the words that mean bad news red.
function colourLine(line: string): string {
  const goodWords = escapeHtml(line).replace(
    /\b(CAUGHT|PASS|green)\b/g,
    '<span class="ok">$1</span>',
  );
  return goodWords.replace(/\b(missed|FAIL|RED)\b/g, '<span class="bad">$1</span>');
}

const TERMINAL_FONT = "13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const TERMINAL_STYLE = [
  "width:800px",
  "padding:18px 20px",
  "box-sizing:border-box",
  `font:${TERMINAL_FONT}`,
  "color:#d6e2dc",
  "background:#0f1412",
].join(";");

function terminalHtml(command: string, body: string): string {
  const prompt = `<div style="color:#7fa391;margin-bottom:6px">$ ${escapeHtml(command)}</div>`;
  const output = `<pre style="margin:0;white-space:pre-wrap">${body}</pre>`;
  return [
    `<html><body style="margin:0;background:#0f1412">`,
    `  <div style="${TERMINAL_STYLE}">`,
    `  ${prompt}${output}`,
    "  <style>.ok{color:#5fd38d}.bad{color:#ff7a6b}</style></div></body></html>",
  ].join("\n");
}

async function terminal(terminalPage: Page, command: string, output: string, file: string) {
  const body = output.split("\n").map(colourLine).join("\n");
  await terminalPage.setViewportSize({ width: 820, height: 200 });
  await terminalPage.setContent(terminalHtml(command, body));
  await terminalPage.locator("div").first().screenshot({ path: file });
}

async function signIn(shopPage: Page, url: string) {
  await shopPage.goto(`${url}/signin`);
  await shopPage.getByLabel("Email").fill("ana@pantryrun.test");
  await shopPage.getByLabel("Password").fill("pantry");
  await shopPage.getByRole("button", { name: "Sign in" }).click();
}

function commandOutput(command: string[]): string {
  const result = Bun.spawnSync(command, { cwd: ROOT, env: { ...process.env, ...env } });
  return result.stdout.toString().trim();
}

async function boardPicture() {
  const output = commandOutput(["bun", "world/board.ts"]);
  await terminal(page, "bun run board", output, PICTURES.board);
  copyFileSync(PICTURES.board, PICTURES.orientBoard);
  console.log(output.split("\n").at(-1));
}

// Browser tool calls are folded into one count so the picture fits.
function foldBrowserCalls(lines: string[]): string[] {
  const folded: string[] = [];
  let browserCalls = 0;
  for (const line of lines) {
    if (/^\s+browser: /.test(line)) {
      browserCalls++;
      continue;
    }
    if (browserCalls) {
      folded.push(`    (${browserCalls} browser tool calls)`);
      browserCalls = 0;
    }
    folded.push(line);
  }
  return folded;
}

// The replay of a real Claude Code run.
async function finishedPicture() {
  const output = commandOutput(["bun", "world/finished/run.ts", "--replay", "1"]);
  const lines = output.split("\n");
  const folded = foldBrowserCalls(lines);
  await terminal(page, "bun run finished", folded.join("\n"), PICTURES.finished);
  console.log(lines.at(-1));
}

async function addToBasket(shopUrl: string, name: string, weight?: string) {
  await page.goto(shopUrl);
  const card = page.getByRole("article", { name, exact: true });
  if (weight) await card.getByLabel(`Weight of ${name}`).selectOption({ label: weight });
  await card.getByRole("button", { name: "Add" }).click();
}

// The orientation order: 1 kg bananas, whole milk with no substitutes, five coffees, a slot.
async function placeOrientationOrder(shopUrl: string) {
  await addToBasket(shopUrl, "Bananas, loose", "1 kg");
  await addToBasket(shopUrl, "Whole milk 2 L");
  await addToBasket(shopUrl, "Ground coffee 227 g");
  await page.goto(`${shopUrl}/basket`);
  await page.getByLabel("Allow substitutes for Whole milk 2 L").uncheck();
  await page.getByLabel("Quantity of Ground coffee 227 g").fill("5");
  await page.getByRole("button", { name: "Update Ground coffee 227 g" }).click();
  await page.goto(`${shopUrl}/slots`);
  await page.getByRole("radio", { name: /Mar 12 10:00/ }).check();
  await page.getByRole("button", { name: "Book slot" }).click();
  await page.waitForURL(/basket/);
  await page.getByRole("button", { name: "Checkout" }).click();
  await page.getByRole("heading", { name: /Order PR-\d+ placed/ }).waitFor();
}

async function shopPictures() {
  const shop = await startShop({ bugs: "none" });
  try {
    await page.setViewportSize({ width: 1100, height: 760 });
    await signIn(page, shop.url);
    await page.goto(shop.url);
    await page.screenshot({ path: PICTURES.shop });
    copyFileSync(PICTURES.shop, PICTURES.orientShop);

    await page.goto(`${shop.url}/basket`);
    await page.screenshot({ path: PICTURES.seed });

    await placeOrientationOrder(shop.url);
    await page.screenshot({ path: PICTURES.order });
  } finally {
    shop.stop();
  }
}

function writeHtmlReport(shopUrl: string, reportFolder: string) {
  const config = join(ROOT, "checks", "lib", "playwright.config.ts");
  const command = ["bun", "x", "playwright", "test", "--config", config, "--reporter=html"];
  // biome-ignore-start lint/style/useNamingConvention: environment variable names are uppercase
  const reportEnv = {
    ...process.env,
    ...env,
    TESTS_DIR: join(PART_ONE, "03-generate-tests-from-the-plan", "solution", "tests"),
    BASE_URL: shopUrl,
    PLAYWRIGHT_HTML_OUTPUT_DIR: reportFolder,
    PLAYWRIGHT_HTML_OPEN: "never",
    CI: "1",
  };
  // biome-ignore-end lint/style/useNamingConvention: environment variable names are uppercase
  Bun.spawnSync(command, { cwd: ROOT, env: reportEnv });
}

// Serves the files of the HTML report, so the browser can open it like a website.
function serveFolder(folder: string) {
  return Bun.serve({
    port: 0,
    fetch: (request) => {
      const path = new URL(request.url).pathname;
      const file = join(folder, path === "/" ? "index.html" : path);
      const contentType = file.endsWith(".html") ? "text/html" : "application/octet-stream";
      try {
        return new Response(readFileSync(file), { headers: { "content-type": contentType } });
      } catch {
        return new Response("not found", { status: 404 });
      }
    },
  });
}

// The HTML report of the sample generated tests, run against a private shop.
async function reportPicture() {
  const shop = await startShop({ bugs: "none" });
  const reportFolder = mkdtempSync(join(tmpdir(), "report-"));
  try {
    writeHtmlReport(shop.url, reportFolder);
    await page.setViewportSize({ width: 1100, height: 900 });
    const server = serveFolder(reportFolder);
    await page.goto(`http://localhost:${server.port}/`);
    await page.getByText("seed").first().waitFor();
    await page.screenshot({ path: PICTURES.report });
    server.stop(true);
  } finally {
    shop.stop();
    rmSync(reportFolder, { recursive: true, force: true });
  }
}

if (wanted("board")) await boardPicture();
if (wanted("finished")) await finishedPicture();
if (wanted("shop")) await shopPictures();
if (wanted("report")) await reportPicture();

await browser.close();
console.log("Pictures written.");
