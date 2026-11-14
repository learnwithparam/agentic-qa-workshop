# Triage the flaky tests: the second half

Do this while you diagnose. A **trace** is a recording of one test run. It shows each step and the page at that moment.

Set `trace: "retain-on-failure"` in the `use` block of `playwright.config.ts`, so every red run keeps a `trace.zip`. Then ask Claude Code:

```text
Run bunx playwright test --repeat-each=20 --shuffle. Show me the trace.zip of one failed run of each flaky test. I will open it with bunx playwright show-trace.
```

Expect: a `trace.zip` for each failed run, in `test-results`.

Open one and look at the page when the step failed. For example, a race shows "Thinking..." where the answer should be.

Add a `trace` field to each entry in `qa/triage.json`: the path of the `trace.zip` you opened.

Then run `bun run verify triage-the-flaky-tests`.

Expect: `Done. All 10 rules pass.`
