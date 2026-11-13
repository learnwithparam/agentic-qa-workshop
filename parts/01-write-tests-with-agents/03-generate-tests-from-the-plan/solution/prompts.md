# How Claude Code got here

You wrote no test code. You asked Playwright's generator agent for one scenario group at a time. You read each
test, and sent Claude Code back when a test broke a rule.

## The prompts

First you added Playwright's agents, then started `claude` in this step's `problem/` folder:

```bash
bunx playwright init-agents --loop=claude
claude
```

Expect: `.claude/agents/` and `.mcp.json` appear, then Claude Code opens.

You sent one prompt per scenario group. The first one:

```text
Use the playwright-test-generator agent on specs/slots.md, section 1, with
tests/seed.spec.ts as the seed. Keep each scenario's title as the test title.
Find elements with getByRole, getByLabel, getByText or getByTestId. No CSS or XPath,
no waitForTimeout, and every test needs an expect.
```

Then the same prompt for `specs/slots.md` section 2, and `specs/basket.md` sections 1 and 2.

Generated tests sometimes find a slot by CSS, such as `locator("#slot-...")`. When one does, send it back:

```text
In tests/slots.spec.ts, "A full slot shows Full and cannot be booked" uses a CSS
selector. Find the slot radio by its role and name instead.
```

## The plan Claude Code showed

For each group, Claude Code said what it would do, like this:

```text
1. Run the seed to reach an empty basket as Ana.
2. For each scenario in section 1, follow the steps in the browser and log each action.
3. Write the tests to tests/slots.spec.ts, starting with "// spec: specs/slots.md".
4. Run the new tests on the fixed build.
```

## What you checked

- Each file starts with `// spec: specs/<plan>.md`.
- Each test title is the scenario's `####` title, word for word.
- No CSS, no XPath, no `waitForTimeout`, and an `expect` in every test.
- `bunx playwright test` printed `16 passed`: 15 scenarios and the seed.

## What you would reject

- Tests that find elements by CSS. See `wrong/css-selectors/`.
- Tests that wait a fixed time instead of letting `expect` wait. See `wrong/sleeps-instead-of-waits/`.
- Test titles that no longer match the plan. For example, see `wrong/titles-drift/`.
