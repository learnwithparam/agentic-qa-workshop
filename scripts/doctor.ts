// bun run doctor: is Claude Code installed and signed in?
// It asks the claude CLI, never a credentials file.
import { claudeStatus, olderThan, TESTED_ON } from "../checks/lib/claude";

const status = claudeStatus();
if (!status.installed) {
  console.log(
    "Claude Code: not found. Install it (see 00-orientation/README.md), " +
      "open a new terminal, then run bun run doctor again.",
  );
  process.exit(1);
}

const version = status.version ?? "unknown version";
let olderNote = "";
if (status.version && olderThan(status.version, TESTED_ON)) {
  olderNote = ` (older than ${TESTED_ON}, the oldest this course is tested on: run claude update)`;
}
console.log(`Claude Code: ${version}${olderNote}`);

if (!status.signedIn) {
  console.log("Signed in: no. Run claude, type /login, and sign in with your Claude account.");
  process.exit(1);
}
console.log("Signed in: yes. Claude Code is ready for this course.");
