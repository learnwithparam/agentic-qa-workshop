// bun run doctor: is Claude Code installed and signed in? Asks the claude CLI, never a credentials file.
import { claudeStatus, olderThan, TESTED_ON } from "../checks/lib/claude";

const s = claudeStatus();
if (!s.installed) {
  console.log(
    "Claude Code: not found. Install it (see 00-orientation/README.md), open a new terminal, then run bun run doctor again.",
  );
  process.exit(1);
}
console.log(
  `Claude Code: ${s.version ?? "unknown version"}${s.version && olderThan(s.version, TESTED_ON) ? ` (older than ${TESTED_ON}, the oldest this course is tested on: run claude update)` : ""}`,
);
if (!s.signedIn) {
  console.log("Signed in: no. Run claude, type /login, and sign in with your Claude account.");
  process.exit(1);
}
console.log("Signed in: yes. Claude Code is ready for this course.");
