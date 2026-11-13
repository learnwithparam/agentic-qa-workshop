// bun parts/05-run-it-as-a-team/images/shots.ts: takes the pictures this part's READMEs show.
// Each is real command output drawn as a dark terminal: the check on a sample solution, or the
// sample gate blocking the flaky pull request.
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { browserEnv } from "../../../checks/lib/browser";
import { ROOT } from "../../../scripts/structure";

const PART = join(ROOT, "parts", "05-run-it-as-a-team");
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
  return good.replace(/\b(FAIL|BLOCKED)\b/g, '<span style="color:#ff7a6b">$1</span>');
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

// The sample gate on the flaky pull request: the stage that blocks it, and why.
async function gatePicture() {
  const gateFolder = join(PART, "04-gate-the-pull-request", "solution");
  const run = Bun.spawnSync(["bun", "qa/gate.ts", "../pulls/flaky-test"], {
    cwd: gateFolder,
    env: { ...process.env, ...environment },
  });
  const output = run.stdout.toString().trim();
  await terminal("bun run gate ../pulls/flaky-test", output, picture("04-gate-the-pull-request"));
}

await checkPicture("compare-mcp-and-cli", "01-compare-mcp-and-cli");
await checkPicture("fuzz-the-api-from-the-schema", "02-fuzz-the-api-from-the-schema");
await checkPicture("measure-the-agent-cost", "03-measure-the-agent-cost");
await gatePicture();
await browser.close();
console.log("Took 4 pictures for Part 5.");
