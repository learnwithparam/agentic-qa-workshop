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

// Asks the system for a port nobody uses, then lets it go so the shop can take it.
function freePort(): number {
  const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const port = listener.port;
  listener.stop(true);
  return port;
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
  const port = freePort();
  const server = Bun.spawn(["bun", join(ROOT, "world", "server.ts")], {
    cwd: ROOT,
    // biome-ignore-start lint/style/useNamingConvention: environment variable names are uppercase
    env: {
      ...process.env,
      PORT: String(port),
      BUGS: options.bugs ?? "none",
      RELEASE: options.release ?? "v1",
      PANTRY_DATA: dataDir,
    },
    // biome-ignore-end lint/style/useNamingConvention: environment variable names are uppercase
    stdout: "ignore",
    stderr: "ignore",
  });
  const url = `http://localhost:${port}`;
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
