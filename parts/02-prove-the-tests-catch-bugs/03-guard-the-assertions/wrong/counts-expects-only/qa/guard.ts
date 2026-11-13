// Stops an agent from weakening a Playwright test.
// It counts expect calls and skipped tests before and after a change.
// Exit 2 with a reason on stderr when a change weakens a test, else exit 0.
import { existsSync, readFileSync } from "node:fs";

type Change = { before: string; after: string };

const countMatches = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0;
const expectCount = (text: string) => countMatches(text, /\bexpect\s*\(/g);
const skipCount = (text: string) => countMatches(text, /\btest\.(skip|fixme)\b/g);

function changeFromHook(input: Record<string, Record<string, string>>): Change {
  const toolInput = input.tool_input ?? {};
  if (input.tool_name === "Write") {
    const file = toolInput.file_path ?? "";
    const before = existsSync(file) ? readFileSync(file, "utf8") : "";
    return { before, after: toolInput.content ?? "" };
  }
  return { before: toolInput.old_string ?? "", after: toolInput.new_string ?? "" };
}

function changeFromDiff(diff: string): Change {
  const lines = diff.split("\n");
  const removed = lines.filter((line) => line.startsWith("-") && !line.startsWith("---"));
  const added = lines.filter((line) => line.startsWith("+") && !line.startsWith("+++"));
  return { before: removed.join("\n"), after: added.join("\n") };
}

function readChange(input: string): Change {
  try {
    return changeFromHook(JSON.parse(input));
  } catch {
    return changeFromDiff(input);
  }
}

const change = readChange(await Bun.stdin.text());
if (expectCount(change.after) < expectCount(change.before)) {
  console.error("guard: a change removes an expect");
  process.exit(2);
}
if (skipCount(change.after) > skipCount(change.before)) {
  console.error("guard: a change skips a test");
  process.exit(2);
}
process.exit(0);
