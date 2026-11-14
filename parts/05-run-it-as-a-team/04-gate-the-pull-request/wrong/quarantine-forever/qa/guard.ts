// The assertion guard from Part 2. It reads a unified diff of test files on stdin.
// Exit 0 accepts the change. Exit 2 rejects it, with the reason on stderr.
// It stops an agent from making a test pass by making it check less.

const EXPECT_CALL = /\bexpect(\.soft|\.poll)?\(/g;
const SKIPPED_TEST = /\btest\.(skip|fixme|only)\b/;
const LOOSER_SETTING = /\b(retries|maxDiffPixels|maxDiffPixelRatio|threshold)\s*:/;
const EXPECTED_VALUE = /\.(toHaveText|toBe|toEqual|toContainText|toHaveCount)\(\s*(.+?)\s*\)/;

type DiffLines = { removed: string[]; added: string[] };

function changedLines(diff: string): DiffLines {
  const lines = diff.split("\n");
  const isChange = (line: string, mark: string) =>
    line.startsWith(mark) && !line.startsWith(mark.repeat(3));
  const removed = lines.filter((line) => isChange(line, "-")).map((line) => line.slice(1));
  const added = lines.filter((line) => isChange(line, "+")).map((line) => line.slice(1));
  return { removed, added };
}

const countExpects = (lines: string[]) =>
  lines.reduce((total, line) => total + (line.match(EXPECT_CALL) ?? []).length, 0);

// An expected value that was removed and came back with a different value for the same matcher.
function changedExpectedValue({ removed, added }: DiffLines): string | null {
  for (const oldLine of removed) {
    const oldMatch = oldLine.match(EXPECTED_VALUE);
    if (!oldMatch) continue;
    const sameMatcher = added.map((line) => line.match(EXPECTED_VALUE));
    const newMatch = sameMatcher.find((match) => match && match[1] === oldMatch[1]);
    if (newMatch && newMatch[2] !== oldMatch[2]) return `${oldMatch[2]} became ${newMatch[2]}`;
  }
  return null;
}

export function reasonToReject(diff: string): string | null {
  const lines = changedLines(diff);
  if (countExpects(lines.removed) > countExpects(lines.added)) return "an expect was removed";
  if (lines.added.some((line) => SKIPPED_TEST.test(line)))
    return "a test was skipped or marked fixme";
  if (lines.added.some((line) => LOOSER_SETTING.test(line))) return "a setting was loosened";
  const changedValue = changedExpectedValue(lines);
  if (changedValue) return `an expected value changed: ${changedValue}`;
  return null;
}

if (import.meta.main) {
  const diff = await Bun.stdin.text();
  const reason = reasonToReject(diff);
  if (reason) {
    console.error(`Guard: rejected, ${reason}.`);
    process.exit(2);
  }
  process.exit(0);
}
