// Starts one Pantry Run shop. PORT, BUGS, RELEASE and PANTRY_DATA choose which one.
import { app } from "./app";
import { activeBugs } from "./bugs";
import { ensureSeeded } from "./store";
import { release } from "./ui";

// A long list of bug names would hide the address, so more than three are only counted.
function describeBugs(bugs: string[]): string {
  if (bugs.length === 0) {
    return "none";
  }
  if (bugs.length > 3) {
    return `${bugs.length} on`;
  }
  return bugs.join(", ");
}

ensureSeeded();
// PORT=0 lets the system pick a free port. The ready line below says which one it picked.
const server = Bun.serve({
  port: Number(process.env.PORT ?? 4173),
  hostname: "127.0.0.1",
  fetch: app.fetch,
});
const port = server.port;
const bugsText = describeBugs(activeBugs());
const releaseText = release() === "v2" ? ", release v2" : "";
console.log(`Pantry Run ready on http://localhost:${port} (bugs: ${bugsText}${releaseText})`);
