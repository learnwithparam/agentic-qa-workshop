# How Claude Code got here

This is a sample answer for a made-up app, so you can see the shape of the files. The report in
`evidence/report.json` was written by hand to match the check. Yours must come from a real run.

## The prompts

You added the agents to your own repo, then opened Claude Code there:

```bash
bunx playwright init-agents --loop=claude
claude
```

Expect: `.claude/agents/` appears, then Claude Code opens.

Then you asked for the plan, the specs, and a fix for the one broken test:

```text
Use the playwright-test-planner agent on the flow "create a note" in my app at the APP_URL. Save the plan in plans/.
```

```text
Use the playwright-test-generator agent on plans/create-a-note.md. Start each spec with a // spec: line.
```

```text
Run the tests. If one is red because a button changed name, use the playwright-test-healer agent. Never remove an expect.
```

## What you checked

- Each scenario in the plan was a thing the product owner wanted. One was rejected.
- Every test kept an `expect`, and none waits with a fixed sleep.
- The saved report lists every test, and none is red or flaky.
