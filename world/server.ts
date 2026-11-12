// Starts one Pantry Run shop. PORT, BUGS, RELEASE and PANTRY_DATA choose which one.
import { app } from "./app";
import { activeBugs } from "./bugs";
import { ensureSeeded } from "./store";
import { release } from "./ui";

ensureSeeded();
const port = Number(process.env.PORT ?? 4173);
Bun.serve({ port, hostname: "127.0.0.1", fetch: app.fetch });
const bugs = activeBugs();
console.log(`Pantry Run ready on http://localhost:${port} (bugs: ${bugs.length ? (bugs.length > 3 ? `${bugs.length} on` : bugs.join(", ")) : "none"}${release() === "v2" ? ", release v2" : ""})`);
