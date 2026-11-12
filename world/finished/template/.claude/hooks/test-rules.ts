// PreToolUse hook on Write and Edit. Claude Code sends the tool call as JSON on stdin.
// For a test file (*.spec.ts) it blocks text that hides a failure or a race: waitForTimeout, test.skip,
// test.fixme. Exit 2 blocks the call and Claude reads the reason on stderr. Exit 0 lets it through.
type HookInput = { hook_event_name?: string; tool_name?: string; tool_input?: { file_path?: string; content?: string; new_string?: string } };

export const RULES: [RegExp, string][] = [
  [/\bwaitForTimeout\s*\(/, "waitForTimeout hides a race; wait for what the shopper sees with expect instead"],
  [/\btest(\.describe)?\.skip\s*\(/, "test.skip hides a test; if a rule fails, keep the test red and report it"],
  [/\btest(\.describe)?\.fixme\s*\(/, "test.fixme hides a test; if a rule fails, keep the test red and report it"],
];

export function verdict(input: HookInput): string | null {
  if (input.hook_event_name !== "PreToolUse") return null;
  if (input.tool_name !== "Write" && input.tool_name !== "Edit") return null;
  const file = input.tool_input?.file_path ?? "";
  if (!file.endsWith(".spec.ts")) return null;
  const text = input.tool_input?.content ?? input.tool_input?.new_string ?? "";
  for (const [re, why] of RULES) if (re.test(text)) return `Blocked by test-rules: ${why} (${file.split("/").pop()}).`;
  return null;
}

if (import.meta.main) {
  let input: HookInput = {};
  try { input = JSON.parse(await Bun.stdin.text()); } catch { process.exit(0); }
  const why = verdict(input);
  if (why) { console.error(why); process.exit(2); }
  process.exit(0);
}
