// Asks the claude CLI itself whether Claude Code is installed and signed in.
// It never reads a credentials file.
export type ClaudeStatus = {
  installed: boolean;
  version: string | null;
  signedIn: boolean;
  how: string | null;
};

// The oldest Claude Code release the course's recordings and checks were run on.
export const TESTED_ON = "2.1.322";

const NOT_INSTALLED: ClaudeStatus = { installed: false, version: null, signedIn: false, how: null };

const run = (args: string[]) => {
  try {
    const finished = Bun.spawnSync(["claude", ...args], {
      stdout: "pipe",
      stderr: "pipe",
      // biome-ignore lint/style/useNamingConvention: environment variable names are uppercase
      env: { ...process.env, NO_COLOR: "1" },
    });
    const output = finished.stdout.toString().trim();
    return { ok: finished.exitCode === 0, out: output };
  } catch {
    return { ok: false, out: "" };
  }
};

export function claudeStatus(): ClaudeStatus {
  const versionRun = run(["--version"]);
  if (!versionRun.ok) return NOT_INSTALLED;
  const version = versionRun.out.match(/\d+\.\d+\.\d+/)?.[0] ?? null;
  const authRun = run(["auth", "status", "--json"]);
  let signedIn = false;
  let how: string | null = null;
  try {
    const authStatus = JSON.parse(authRun.out);
    signedIn = authStatus.loggedIn === true;
    how = authStatus.authMethod ?? null;
  } catch {
    // If the answer is not JSON, we cannot tell, so we keep "not signed in".
  }
  return { installed: true, version, signedIn, how };
}

// Compares two "major.minor.patch" versions, one number at a time.
export function olderThan(version: string, floor: string): boolean {
  const versionParts = version.split(".").map(Number);
  const floorParts = floor.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const versionPart = versionParts[i] ?? 0;
    const floorPart = floorParts[i] ?? 0;
    if (versionPart !== floorPart) return versionPart < floorPart;
  }
  return false;
}
