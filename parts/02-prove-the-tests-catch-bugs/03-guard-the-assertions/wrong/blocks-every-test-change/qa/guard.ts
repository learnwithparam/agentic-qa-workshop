// Stops an agent from weakening a Playwright test.
// To be safe, it rejects every change to a test file.
// Exit 2 with a reason on stderr when a change touches a test file, else exit 0.

function changedFile(input: string): string {
  try {
    const hookInput = JSON.parse(input);
    return hookInput.tool_input?.file_path ?? "";
  } catch {
    const header = input.split("\n").find((line) => line.startsWith("+++ "));
    return header ?? "";
  }
}

const file = changedFile(await Bun.stdin.text());
const isTestFile = file.includes(".spec.ts") || file.includes("playwright.config.ts");
if (isTestFile) {
  console.error(`guard: ${file} is a test file; agents may not change test files`);
  process.exit(2);
}
process.exit(0);
