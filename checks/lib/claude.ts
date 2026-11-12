// Asks the claude CLI itself whether Claude Code is installed and signed in. It never reads a credentials file.
export type ClaudeStatus = { installed: boolean; version: string | null; signedIn: boolean; how: string | null };

// The oldest Claude Code release the course's recordings and checks were run on.
export const TESTED_ON = "2.1.322";

const run = (args: string[]) => {
  try {
    const r = Bun.spawnSync(["claude", ...args], { stdout: "pipe", stderr: "pipe", env: { ...process.env, NO_COLOR: "1" } });
    return { ok: r.exitCode === 0, out: r.stdout.toString().trim() };
  } catch {
    return { ok: false, out: "" };
  }
};

export function claudeStatus(): ClaudeStatus {
  const v = run(["--version"]);
  if (!v.ok) return { installed: false, version: null, signedIn: false, how: null };
  const version = v.out.match(/\d+\.\d+\.\d+/)?.[0] ?? null;
  const a = run(["auth", "status", "--json"]);
  let signedIn = false;
  let how: string | null = null;
  try {
    const j = JSON.parse(a.out);
    signedIn = j.loggedIn === true;
    how = j.authMethod ?? null;
  } catch {}
  return { installed: true, version, signedIn, how };
}

export function olderThan(v: string, floor: string): boolean {
  const a = v.split(".").map(Number), b = floor.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  return false;
}
