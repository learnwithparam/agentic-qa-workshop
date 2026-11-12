// Several rules in one check read the same run. This keeps one run per folder and content.
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function hashDir(dir: string): string {
  const h = createHash("sha256");
  const walk = (d: string) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d).sort()) {
      if (e === "node_modules" || e === "test-results" || e === "playwright-report") continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else h.update(p).update(readFileSync(p));
    }
  };
  walk(dir);
  return h.digest("hex");
}

const cache = new Map<string, Promise<unknown>>();
export function once<T>(name: string, dir: string, fn: () => Promise<T>): Promise<T> {
  const key = `${name}|${dir}|${hashDir(dir)}`;
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key) as Promise<T>;
}
