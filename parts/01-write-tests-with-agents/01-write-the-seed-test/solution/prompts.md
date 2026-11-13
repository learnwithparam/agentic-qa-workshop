# How Claude Code got here

You wrote no test code. You gave Claude Code one prompt, read its plan, and checked the result. This page shows
each part.

## The prompt

You started `claude` in this step's `problem/` folder and typed:

```text
Fill in tests/seed.spec.ts. It must reset Pantry Run with request.post("/__test/reset"),
sign in on /signin as ana@pantryrun.test with password pantry, then open /basket and
expect the empty basket. Use getByLabel and getByRole, not CSS. Show me your plan first.
```

## The plan Claude Code showed

Before it edited anything, Claude Code showed a plan like this:

```text
1. Reset the shop data with request.post("/__test/reset").
2. Go to /signin, fill Email and Password with getByLabel, click the "Sign in" button.
3. Go to /basket.
4. Expect the heading "Your basket" and the empty basket (test id "empty-basket").
5. Run `bunx playwright test --repeat-each=3` to prove it passes three times.
```

You said yes, because the plan resets first, adds nothing, and ends with an `expect`.

## What you checked

- The first line of the test is the reset. Without it, the second run starts with old data.
- The test finds the fields by label and the button by role, not by CSS.
- The test ends on `/basket` and checks the empty basket.
- `bunx playwright test --repeat-each=3` printed `3 passed`.

## What you would reject

Each of these is a real mistake a weaker prompt makes. The check rejects each one.

- The plan adds an item "to make the basket page show something". For example, see `wrong/adds-an-item/`.
- The test has no `expect`, so it passes whatever the page shows. See `wrong/no-expect/`.
- The test skips the reset. It passes once, then fails. See `wrong/no-reset/`.
