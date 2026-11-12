// bun run shots: captures every picture the READMEs show, from the real shop and real command output.
// Pages are screenshots of a private shop. Terminal output is rendered as a dark terminal and screenshotted.
import { chromium, type Page } from "@playwright/test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { browserEnv } from "../checks/lib/browser";
import { startShop } from "../checks/lib/world";
import { ROOT } from "../scripts/structure";

const P1 = join(ROOT, "parts", "01-write-tests-with-agents");
const OUT = {
  board: join(ROOT, "images", "finished-system.png"),
  finished: join(ROOT, "images", "finished-claude-code.png"),
  shop: join(ROOT, "images", "shop.png"),
  orientBoard: join(ROOT, "00-orientation", "images", "goal-board.png"),
  orientShop: join(ROOT, "00-orientation", "images", "shop.png"),
  order: join(ROOT, "00-orientation", "meet-the-shop", "images", "expected.png"),
  seed: join(P1, "01-write-the-seed-test", "images", "expected.png"),
  report: join(P1, "03-generate-tests-from-the-plan", "images", "expected.png"),
};
for (const p of Object.values(OUT)) mkdirSync(dirname(p), { recursive: true });

const only = process.argv[2];
const env = browserEnv();
const browser = await chromium.launch(env.CHROMIUM_PATH ? { executablePath: env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
async function terminal(p: Page, command: string, output: string, file: string) {
  const body = output
    .split("\n")
    .map((l) => esc(l).replace(/\b(CAUGHT|PASS|green)\b/g, '<span class="ok">$1</span>').replace(/\b(missed|FAIL|RED)\b/g, '<span class="bad">$1</span>'))
    .join("\n");
  await p.setViewportSize({ width: 820, height: 200 });
  await p.setContent(`<html><body style="margin:0;background:#0f1412">
  <div style="width:800px;padding:18px 20px;box-sizing:border-box;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#d6e2dc;background:#0f1412">
  <div style="color:#7fa391;margin-bottom:6px">$ ${esc(command)}</div><pre style="margin:0;white-space:pre-wrap">${body}</pre>
  <style>.ok{color:#5fd38d}.bad{color:#ff7a6b}</style></div></body></html>`);
  await p.locator("div").first().screenshot({ path: file });
}

async function signIn(p: Page, url: string) {
  await p.goto(`${url}/signin`);
  await p.getByLabel("Email").fill("ana@pantryrun.test");
  await p.getByLabel("Password").fill("pantry");
  await p.getByRole("button", { name: "Sign in" }).click();
}

if (!only || only === "board") {
  const r = Bun.spawnSync(["bun", "world/board.ts"], { cwd: ROOT, env: { ...process.env, ...env } });
  const out = r.stdout.toString().trim();
  await terminal(page, "bun run board", out, OUT.board);
  copyFileSync(OUT.board, OUT.orientBoard);
  console.log(out.split("\n").at(-1));
}

if (!only || only === "finished") {
  // The replay of a real Claude Code run. Browser tool calls are folded into one count so the picture fits.
  const r = Bun.spawnSync(["bun", "world/finished/run.ts", "--replay", "1"], { cwd: ROOT, env: { ...process.env, ...env } });
  const lines = r.stdout.toString().trim().split("\n");
  const out: string[] = [];
  let browserCalls = 0;
  for (const l of lines) {
    if (/^\s+browser: /.test(l)) { browserCalls++; continue; }
    if (browserCalls) { out.push(`    (${browserCalls} browser tool calls)`); browserCalls = 0; }
    out.push(l);
  }
  await terminal(page, "bun run finished", out.join("\n"), OUT.finished);
  console.log(lines.at(-1));
}

if (!only || only === "shop") {
  const shop = await startShop({ bugs: "none" });
  try {
    await page.setViewportSize({ width: 1100, height: 760 });
    await signIn(page, shop.url);
    await page.goto(shop.url);
    await page.screenshot({ path: OUT.shop });
    copyFileSync(OUT.shop, OUT.orientShop);

    await page.goto(`${shop.url}/basket`);
    await page.screenshot({ path: OUT.seed });

    // The orientation order: 1 kg bananas, whole milk with no substitutes, five coffees, a slot.
    const add = async (name: string, weight?: string) => {
      await page.goto(shop.url);
      const card = page.getByRole("article", { name, exact: true });
      if (weight) await card.getByLabel(`Weight of ${name}`).selectOption({ label: weight });
      await card.getByRole("button", { name: "Add" }).click();
    };
    await add("Bananas, loose", "1 kg");
    await add("Whole milk 2 L");
    await add("Ground coffee 227 g");
    await page.goto(`${shop.url}/basket`);
    await page.getByLabel("Allow substitutes for Whole milk 2 L").uncheck();
    await page.getByLabel("Quantity of Ground coffee 227 g").fill("5");
    await page.getByRole("button", { name: "Update Ground coffee 227 g" }).click();
    await page.goto(`${shop.url}/slots`);
    await page.getByRole("radio", { name: /Mar 12 10:00/ }).check();
    await page.getByRole("button", { name: "Book slot" }).click();
    await page.waitForURL(/basket/);
    await page.getByRole("button", { name: "Checkout" }).click();
    await page.getByRole("heading", { name: /Order PR-\d+ placed/ }).waitFor();
    await page.screenshot({ path: OUT.order });
  } finally {
    shop.stop();
  }
}

if (!only || only === "report") {
  // The HTML report of the sample generated tests, run against a private shop.
  const shop = await startShop({ bugs: "none" });
  const work = mkdtempSync(join(tmpdir(), "report-"));
  try {
    Bun.spawnSync(["bun", "x", "playwright", "test", "--config", join(ROOT, "checks", "lib", "playwright.config.ts"), "--reporter=html"], {
      cwd: ROOT,
      env: { ...process.env, ...env, TESTS_DIR: join(P1, "03-generate-tests-from-the-plan", "solution", "tests"), BASE_URL: shop.url, PLAYWRIGHT_HTML_OUTPUT_DIR: work, PLAYWRIGHT_HTML_OPEN: "never", CI: "1" },
    });
    await page.setViewportSize({ width: 1100, height: 900 });
    const server = Bun.serve({ port: 0, fetch: (req) => {
      const path = new URL(req.url).pathname;
      const file = join(work, path === "/" ? "index.html" : path);
      try { return new Response(readFileSync(file), { headers: { "content-type": file.endsWith(".html") ? "text/html" : "application/octet-stream" } }); } catch { return new Response("not found", { status: 404 }); }
    } });
    await page.goto(`http://localhost:${server.port}/`);
    await page.getByText("seed").first().waitFor();
    await page.screenshot({ path: OUT.report });
    server.stop(true);
  } finally {
    shop.stop();
    rmSync(work, { recursive: true, force: true });
  }
}

await browser.close();
console.log("Pictures written.");
