// Starts a private Pantry Run for a check.
// Each shop gets its own port, its own data folder, and the bugs and release the check chose.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "../../scripts/structure";
import { ensurePackages } from "./browser";
import { readEvents } from "./events";

export type Shop = {
  url: string;
  dataDir: string;
  events: () => ReturnType<typeof readEvents>;
  stop: () => void;
};

type ShopOptions = { bugs?: string; release?: "v1" | "v2" };

// How many times we ask the shop if it is ready, with 100 milliseconds between tries.
const READY_TRIES = 100;

// The shop starts on port 0, so the system gives it a free port and nobody can take that port
// first. The shop prints "Pantry Run ready on http://localhost:<port> ...", and we read the port.
async function readPort(output: ReadableStream<Uint8Array>): Promise<number> {
  const reader = output.getReader();
  const decoder = new TextDecoder();
  let printed = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      printed += decoder.decode(value);
      const found = printed.match(/ready on http:\/\/localhost:(\d+)/);
      if (found) return Number(found[1]);
    }
  } finally {
    // Let go of the output without closing it, so the shop can keep running.
    reader.releaseLock();
  }
  throw new Error(`The shop stopped before it was ready: ${printed.trim()}`);
}

async function isHealthy(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/health`);
    return response.ok;
  } catch {
    // The server is not listening yet.
    return false;
  }
}

async function waitUntilReady(url: string, server: { kill: () => void }) {
  for (let i = 0; i < READY_TRIES; i++) {
    if (await isHealthy(url)) return;
    await Bun.sleep(100);
  }
  server.kill();
  throw new Error(`The shop did not start on ${url}`);
}

function removeFolder(folder: string) {
  try {
    rmSync(folder, { recursive: true, force: true });
  } catch {
    // A folder we cannot remove is left in the temporary folder; that is harmless.
  }
}

export async function startShop(options: ShopOptions = {}): Promise<Shop> {
  ensurePackages();
  const dataDir = mkdtempSync(join(tmpdir(), "pantry-"));
  const server = Bun.spawn(["bun", join(ROOT, "world", "server.ts")], {
    cwd: ROOT,
    // biome-ignore-start lint/style/useNamingConvention: environment variable names are uppercase
    env: {
      ...process.env,
      PORT: "0",
      BUGS: options.bugs ?? "none",
      RELEASE: options.release ?? "v1",
      PANTRY_DATA: dataDir,
    },
    // biome-ignore-end lint/style/useNamingConvention: environment variable names are uppercase
    stdout: "pipe",
    stderr: "ignore",
  });
  // A shop that never says it is ready is stopped, so a check never waits forever.
  const giveUp = setTimeout(() => server.kill(), READY_TRIES * 100);
  const port = await readPort(server.stdout);
  clearTimeout(giveUp);
  const url = `http://127.0.0.1:${port}`;
  await waitUntilReady(url, server);
  return {
    url,
    dataDir,
    events: () => readEvents(dataDir),
    stop: () => {
      server.kill();
      removeFolder(dataDir);
    },
  };
}

export async function withShop<T>(
  options: ShopOptions,
  work: (shop: Shop) => Promise<T>,
): Promise<T> {
  const shop = await startShop(options);
  try {
    return await work(shop);
  } finally {
    shop.stop();
  }
}
