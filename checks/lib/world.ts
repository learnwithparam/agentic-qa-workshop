// Starts a private Pantry Run for a check: its own port, its own data folder, chosen bugs and release.
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

function freePort(): number {
  const s = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const p = s.port;
  s.stop(true);
  return p;
}

export async function startShop(
  opts: { bugs?: string; release?: "v1" | "v2" } = {},
): Promise<Shop> {
  ensurePackages();
  const dataDir = mkdtempSync(join(tmpdir(), "pantry-"));
  const port = freePort();
  const proc = Bun.spawn(["bun", join(ROOT, "world", "server.ts")], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      BUGS: opts.bugs ?? "none",
      RELEASE: opts.release ?? "v1",
      PANTRY_DATA: dataDir,
    },
    stdout: "ignore",
    stderr: "ignore",
  });
  const url = `http://localhost:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${url}/health`)).ok) break;
    } catch {}
    await Bun.sleep(100);
    if (i === 99) {
      proc.kill();
      throw new Error(`The shop did not start on ${url}`);
    }
  }
  return {
    url,
    dataDir,
    events: () => readEvents(dataDir),
    stop: () => {
      proc.kill();
      try {
        rmSync(dataDir, { recursive: true, force: true });
      } catch {}
    },
  };
}

export async function withShop<T>(
  opts: { bugs?: string; release?: "v1" | "v2" },
  fn: (s: Shop) => Promise<T>,
): Promise<T> {
  const shop = await startShop(opts);
  try {
    return await fn(shop);
  } finally {
    shop.stop();
  }
}
