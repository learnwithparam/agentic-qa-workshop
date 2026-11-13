// Several rules in one check read the same run. This keeps one run per folder and content.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Folders that a run writes into itself, so they must not change the fingerprint.
const IGNORED_FOLDERS = new Set(["node_modules", "test-results", "playwright-report"]);

type Hash = ReturnType<typeof createHash>;

function addFolderToHash(hash: Hash, folder: string) {
  if (!existsSync(folder)) return;
  const entries = readdirSync(folder).sort();
  for (const entry of entries) {
    if (IGNORED_FOLDERS.has(entry)) continue;
    const path = join(folder, entry);
    if (statSync(path).isDirectory()) {
      addFolderToHash(hash, path);
    } else {
      hash.update(path).update(readFileSync(path));
    }
  }
}

// A fingerprint of every file name and file content in a folder.
function hashDir(dir: string): string {
  const hash = createHash("sha256");
  addFolderToHash(hash, dir);
  return hash.digest("hex");
}

const cache = new Map<string, Promise<unknown>>();

export function once<T>(name: string, dir: string, start: () => Promise<T>): Promise<T> {
  const key = `${name}|${dir}|${hashDir(dir)}`;
  if (!cache.has(key)) cache.set(key, start());
  return cache.get(key) as Promise<T>;
}
