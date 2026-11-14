# How Claude Code got here

You wrote no test code. You asked Playwright's three agents for a plan, a spec and a fix, and you reviewed each
file.

## The prompts

First you added the agents, then started `claude` in the `problem/` folder:

```bash
bunx playwright init-agents --loop=claude
claude
```

Expect: `.claude/agents/` and `.mcp.json` appear, then Claude Code opens. This folder keeps those generated files.

Then you asked for the plan and the spec:

```text
Use the playwright-test-planner agent to plan the flow "book a delivery slot" from
world/requirements/slots.md. Save it as specs/book-a-slot.md with at least 3 scenarios.
Then use the playwright-test-generator agent to write tests/book-a-slot.spec.ts, with
tests/seed.spec.ts as the seed. Start the file with // spec: specs/book-a-slot.md.
```

After the scripted break, you sent the healer in:

```text
Use the playwright-test-healer agent on tests/book-a-slot.spec.ts. Fix the locator only.
Do not remove or weaken any expect.
```

## The plan Claude Code showed

Expect three scenarios in the plan: a full slot, the booked slot in the basket, and checkout without a slot.
After the break, expect the healer to point at the button now named "Reserve slot" and to change one locator back.

## What you checked

- Each plan scenario has a test with the same title.
- The healed spec has the same number of `expect` calls as the broken one.
- The healer changed the locator and nothing else. `qa/healing/broken/` keeps the broken copy to compare.
